import Dexie, { type EntityTable } from 'dexie';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_SETTINGS, MAX_VIDEO_SIZE_BYTES } from '../defaults';
import { COMBO_NOTATION_PARSER_VERSION, parseComboNotation } from '../parser';
import { importDataSchema } from '../schemas';
import type {
  Character,
  Combo,
  Game,
  NotationColors,
  UserSettings,
} from '../types';

const ZIP_BACKUP_METADATA_FILE = 'backup.json';
const ZIP_BACKUP_VIDEO_DIR = 'videos';

export interface DemoVideo {
  id: string;
  data: ArrayBuffer;
  mimeType: string;
  fileName: string;
}

export interface ZipImportProgress {
  phase: 'loading' | 'videos' | 'finalizing';
  current: number;
  total: number | null;
}

const db = new Dexie('FightingGameComboTracker') as Dexie & {
  games: EntityTable<Game, 'id'>;
  characters: EntityTable<Character, 'id'>;
  combos: EntityTable<Combo, 'id'>;
  settings: EntityTable<UserSettings & { id: number }, 'id'>;
  demoVideos: EntityTable<DemoVideo, 'id'>;
};

db.version(1).stores({
  games: 'id, name, createdAt',
  characters: 'id, gameId, name, createdAt',
  combos: 'id, characterId, name, notation, createdAt, updatedAt, *tags',
  settings: 'id',
});

db.version(2)
  .stores({
    games: 'id, name, createdAt',
    characters: 'id, gameId, name, createdAt',
    combos:
      'id, characterId, name, notation, createdAt, updatedAt, *tags, sortOrder',
    settings: 'id',
  })
  .upgrade((tx) => {
    return tx
      .table('combos')
      .toCollection()
      .modify((combo) => {
        if (combo.sortOrder === undefined) {
          combo.sortOrder = combo.createdAt;
        }
      });
  });

db.version(3).stores({
  games: 'id, name, createdAt',
  characters: 'id, gameId, name, createdAt',
  combos:
    'id, characterId, name, notation, createdAt, updatedAt, *tags, sortOrder',
  settings: 'id',
  demoVideos: 'id',
});

// Version 4: no schema changes — reserved for future migration.
// Dexie requires strictly increasing version numbers; this bump
// holds the slot without modifying any table definitions.
db.version(4).stores({
  games: 'id, name, createdAt',
  characters: 'id, gameId, name, createdAt',
  combos:
    'id, characterId, name, notation, createdAt, updatedAt, *tags, sortOrder',
  settings: 'id',
  demoVideos: 'id',
});

db.version(5).stores({
  games: 'id, name, createdAt',
  characters: 'id, gameId, name, createdAt',
  combos:
    'id, characterId, name, notation, description, createdAt, updatedAt, *tags, sortOrder',
  settings: 'id',
  demoVideos: 'id',
});

export function generateId(): string {
  return uuidv4();
}

/**
 * One-time migration: older versions stored notationColors as oklch() strings.
 * Map the two known defaults to their correct hex equivalents; any other
 * unknown oklch value (produced by the now-removed buggy hexToOklch) falls
 * back to the corresponding default since the stored value was incorrect anyway.
 */
const OKLCH_TO_HEX: Record<string, string> = {
  'oklch(0.85 0.05 265)': '#bdceef',
  'oklch(0.55 0.02 265)': '#6c727e',
};

export function getLocalVideoId(demoUrl?: string): string | null {
  if (!demoUrl?.startsWith('local:')) {
    return null;
  }

  const videoId = demoUrl.slice('local:'.length);
  return videoId || null;
}

function collectLocalVideoIds(combos: Array<Pick<Combo, 'demoUrl'>>): string[] {
  const videoIds = new Set<string>();

  for (const combo of combos) {
    const videoId = getLocalVideoId(combo.demoUrl);
    if (videoId) {
      videoIds.add(videoId);
    }
  }

  return [...videoIds];
}

function toUniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function sanitizeComboLocalVideo<T extends Combo>(
  combo: T,
  availableVideoIds: Set<string>,
): T {
  const videoId = getLocalVideoId(combo.demoUrl);
  if (!videoId || availableVideoIds.has(videoId)) {
    return combo;
  }

  return {
    ...combo,
    demoUrl: undefined,
    demoFileName: undefined,
    demoVideoTitle: undefined,
  };
}

function sanitizeCombosLocalVideos(
  combos: Combo[],
  availableVideoIds: Set<string>,
): Combo[] {
  return combos.map((combo) =>
    sanitizeComboLocalVideo(combo, availableVideoIds),
  );
}

function migrateNotationColors(colors: Record<string, string>): {
  colors: Record<string, string>;
  changed: boolean;
} {
  const migrated = { ...colors };
  let changed = false;
  for (const key of Object.keys(colors)) {
    const val = colors[key];
    if (typeof val === 'string' && val.startsWith('oklch(')) {
      const fallback =
        key in DEFAULT_SETTINGS.notationColors
          ? (DEFAULT_SETTINGS.notationColors as Record<string, string>)[key]
          : '#bdceef';
      migrated[key] = OKLCH_TO_HEX[val] ?? fallback;
      changed = true;
    }
  }
  return { colors: migrated, changed };
}

async function reparseStoredCombos(): Promise<void> {
  const [games, characters, combos] = await Promise.all([
    db.games.toArray(),
    db.characters.toArray(),
    db.combos.toArray(),
  ]);

  if (combos.length === 0) {
    return;
  }

  const gameButtonsById = new Map<string, string[]>();
  for (const game of games) {
    gameButtonsById.set(game.id, game.buttonLayout);
  }

  const characterGameById = new Map<string, string>();
  for (const character of characters) {
    characterGameById.set(character.id, character.gameId);
  }

  const reparsedCombos = combos.map((combo) => {
    const gameId = characterGameById.get(combo.characterId);
    const customButtons = gameId ? gameButtonsById.get(gameId) : undefined;

    return {
      ...combo,
      parsedNotation: parseComboNotation(combo.notation, customButtons),
    };
  });

  await db.combos.bulkPut(reparsedCombos);
}

export const indexedDbStorage = {
  games: {
    getAll: () => db.games.toArray(),
    get: (id: string) => db.games.get(id),
    add: async (game: Omit<Game, 'id' | 'createdAt' | 'updatedAt'>) => {
      const id = generateId();
      const now = Date.now();
      await db.games.add({
        ...game,
        id,
        createdAt: now,
        updatedAt: now,
      });
      return id;
    },
    update: async (id: string, updates: Partial<Game>) => {
      await db.games.update(id, {
        ...updates,
        updatedAt: Date.now(),
      });
    },
    delete: async (id: string) => {
      let characterIds: string[] = [];
      await db.transaction(
        'rw',
        [db.games, db.characters, db.combos, db.demoVideos],
        async () => {
          const characters = await db.characters
            .where('gameId')
            .equals(id)
            .toArray();
          characterIds = characters.map((c) => c.id);

          if (characterIds.length > 0) {
            const combos = await db.combos
              .where('characterId')
              .anyOf(characterIds)
              .toArray();
            const videoIds = collectLocalVideoIds(combos);
            if (videoIds.length > 0) {
              await db.demoVideos.bulkDelete(videoIds);
            }
            await db.combos.where('characterId').anyOf(characterIds).delete();
          }
          await db.characters.where('gameId').equals(id).delete();
          await db.games.delete(id);
        },
      );
      await indexedDbStorage.settings.removeNotesOverrides([
        ...characterIds,
        id,
      ]);
    },
    bulkDelete: async (ids: string[]) => {
      const uniqueIds = toUniqueIds(ids);
      if (uniqueIds.length === 0) {
        return;
      }

      let characterIds: string[] = [];
      await db.transaction(
        'rw',
        [db.games, db.characters, db.combos, db.demoVideos],
        async () => {
          const characters = await db.characters
            .where('gameId')
            .anyOf(uniqueIds)
            .toArray();
          characterIds = characters.map((c) => c.id);

          if (characterIds.length > 0) {
            const combos = await db.combos
              .where('characterId')
              .anyOf(characterIds)
              .toArray();
            const videoIds = collectLocalVideoIds(combos);
            if (videoIds.length > 0) {
              await db.demoVideos.bulkDelete(videoIds);
            }
            await db.combos.where('characterId').anyOf(characterIds).delete();
          }

          await db.characters.where('gameId').anyOf(uniqueIds).delete();
          await db.games.bulkDelete(uniqueIds);
        },
      );

      await indexedDbStorage.settings.removeNotesOverrides([
        ...characterIds,
        ...uniqueIds,
      ]);
    },
  },

  characters: {
    getAll: () => db.characters.toArray(),
    getByGame: (gameId: string) =>
      db.characters.where('gameId').equals(gameId).toArray(),
    get: (id: string) => db.characters.get(id),
    add: async (
      character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>,
    ) => {
      const id = generateId();
      const now = Date.now();
      await db.characters.add({
        ...character,
        id,
        createdAt: now,
        updatedAt: now,
      });
      return id;
    },
    update: async (id: string, updates: Partial<Character>) => {
      await db.characters.update(id, {
        ...updates,
        updatedAt: Date.now(),
      });
    },
    delete: async (id: string) => {
      await db.transaction(
        'rw',
        [db.characters, db.combos, db.demoVideos],
        async () => {
          const combos = await db.combos
            .where('characterId')
            .equals(id)
            .toArray();
          const videoIds = collectLocalVideoIds(combos);
          if (videoIds.length > 0) {
            await db.demoVideos.bulkDelete(videoIds);
          }
          await db.combos.where('characterId').equals(id).delete();
          await db.characters.delete(id);
        },
      );
      await indexedDbStorage.settings.removeNotesOverride(id);
    },
    bulkDelete: async (ids: string[]) => {
      await db.transaction(
        'rw',
        [db.characters, db.combos, db.demoVideos],
        async () => {
          const combos = await db.combos
            .where('characterId')
            .anyOf(ids)
            .toArray();
          const videoIds = collectLocalVideoIds(combos);
          if (videoIds.length > 0) {
            await db.demoVideos.bulkDelete(videoIds);
          }
          await db.combos.where('characterId').anyOf(ids).delete();
          await db.characters.bulkDelete(ids);
        },
      );
      await indexedDbStorage.settings.removeNotesOverrides(ids);
    },
  },

  combos: {
    getAll: () => db.combos.toArray(),
    getByCharacter: (characterId: string) =>
      db.combos.where('characterId').equals(characterId).sortBy('sortOrder'),
    get: (id: string) => db.combos.get(id),
    add: async (
      combo: Omit<Combo, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'>,
    ) => {
      const id = generateId();
      const now = Date.now();
      await db.transaction('rw', db.combos, async () => {
        const existing = await db.combos
          .where('characterId')
          .equals(combo.characterId)
          .toArray();
        const maxOrder = existing.reduce(
          (max, current) => Math.max(max, current.sortOrder ?? 0),
          -1,
        );
        await db.combos.add({
          ...combo,
          id,
          sortOrder: maxOrder + 1,
          createdAt: now,
          updatedAt: now,
        });
      });
      return id;
    },
    update: async (id: string, updates: Partial<Combo>) => {
      await db.combos.update(id, {
        ...updates,
        updatedAt: Date.now(),
      });
    },
    delete: async (id: string) => {
      await db.transaction('rw', [db.combos, db.demoVideos], async () => {
        const combo = await db.combos.get(id);
        const videoId = getLocalVideoId(combo?.demoUrl);
        if (videoId) {
          await db.demoVideos.delete(videoId);
        }
        await db.combos.delete(id);
      });
    },
    bulkDelete: async (ids: string[]) => {
      const uniqueIds = toUniqueIds(ids);
      if (uniqueIds.length === 0) {
        return;
      }

      await db.transaction('rw', [db.combos, db.demoVideos], async () => {
        const combos = (await db.combos.bulkGet(uniqueIds)).filter(
          (combo): combo is Combo => combo !== undefined,
        );
        const videoIds = collectLocalVideoIds(combos);
        if (videoIds.length > 0) {
          await db.demoVideos.bulkDelete(videoIds);
        }
        await db.combos.bulkDelete(uniqueIds);
      });
    },
    markOutdated: async (ids: string[], outdated: boolean) => {
      const uniqueIds = toUniqueIds(ids);
      if (uniqueIds.length === 0) {
        return;
      }

      await db.transaction('rw', db.combos, async () => {
        for (const id of uniqueIds) {
          await db.combos.update(id, {
            outdated: outdated || undefined,
            updatedAt: Date.now(),
          });
        }
      });
    },
    reorder: async (orderedIds: string[]) => {
      await db.transaction('rw', db.combos, async () => {
        const combos = await db.combos.bulkGet(orderedIds);
        const now = Date.now();
        const reorderedCombos = combos
          .filter((combo): combo is Combo => combo !== undefined)
          .map((combo, index) => ({
            ...combo,
            sortOrder: index,
            updatedAt: now,
          }));

        if (reorderedCombos.length > 0) {
          await db.combos.bulkPut(reorderedCombos);
        }
      });
    },
    search: async (query: string) => {
      const trimmedQuery = query.trim().toLowerCase();
      if (!trimmedQuery) {
        return [];
      }

      // Filter combos with substring matching (consistent with in-memory search)
      const results = await db.combos
        .filter((combo) => {
          return (
            combo.name.toLowerCase().includes(trimmedQuery) ||
            combo.notation.toLowerCase().includes(trimmedQuery) ||
            combo.description?.toLowerCase().includes(trimmedQuery) ||
            combo.tags.some((t) => t.toLowerCase().includes(trimmedQuery))
          );
        })
        .toArray();

      return results.sort((a, b) => a.sortOrder - b.sortOrder);
    },
  },

  settings: {
    /**
     * Read-only query — safe to call inside useLiveQuery.
     * Returns stored settings, or the defaults if none exist yet.
     */
    get: async (): Promise<UserSettings> => {
      const settings = await db.settings.get(1);
      if (!settings) return DEFAULT_SETTINGS;
      const { id: _id, ...rest } = settings;
      return rest;
    },
    /**
     * Runs once at app startup (outside any liveQuery context).
     * Initialises the settings row on first launch and applies
     * any pending data migrations (e.g. oklch → hex colour values).
     */
    init: async (options?: {
      onReparseStart?: () => void;
      onReparseEnd?: () => void;
    }): Promise<void> => {
      const settings = await db.settings.get(1);
      if (!settings) {
        await db.settings.add({ id: 1, ...DEFAULT_SETTINGS });
        return;
      }

      const pendingSettingsUpdates: Partial<UserSettings> = {};

      const { colors: migratedColors, changed } = migrateNotationColors(
        settings.notationColors,
      );
      if (changed) {
        pendingSettingsUpdates.notationColors =
          migratedColors as NotationColors;
      }

      const storedParserVersion = settings.parsedNotationVersion ?? 0;
      if (storedParserVersion < COMBO_NOTATION_PARSER_VERSION) {
        options?.onReparseStart?.();
        try {
          await reparseStoredCombos();
        } finally {
          options?.onReparseEnd?.();
        }
        pendingSettingsUpdates.parsedNotationVersion =
          COMBO_NOTATION_PARSER_VERSION;
      }

      if (Object.keys(pendingSettingsUpdates).length > 0) {
        await db.settings.update(1, pendingSettingsUpdates);
      }
    },
    update: async (updates: Partial<UserSettings>) => {
      const current = await db.settings.get(1);
      if (!current) {
        await db.settings.add({ id: 1, ...DEFAULT_SETTINGS, ...updates });
      } else {
        await db.settings.update(1, updates);
      }
    },
    getNotesOverrides: async (): Promise<string[]> => {
      const settings = await db.settings.get(1);
      return settings?.notesOverrides ?? [];
    },
    setNotesOverrides: async (entityIds: string[]): Promise<void> => {
      await indexedDbStorage.settings.update({
        notesOverrides: toUniqueIds(entityIds),
      });
    },
    removeNotesOverride: async (entityId: string): Promise<void> => {
      await indexedDbStorage.settings.removeNotesOverrides([entityId]);
    },
    removeNotesOverrides: async (entityIds: string[]): Promise<void> => {
      const uniqueIds = toUniqueIds(entityIds);
      if (uniqueIds.length === 0) {
        return;
      }

      const currentOverrides =
        await indexedDbStorage.settings.getNotesOverrides();
      const idsToRemove = new Set(uniqueIds);
      const nextOverrides = currentOverrides.filter(
        (id) => !idsToRemove.has(id),
      );

      if (nextOverrides.length !== currentOverrides.length) {
        await indexedDbStorage.settings.setNotesOverrides(nextOverrides);
      }
    },
  },

  gameStats: {
    getInputs: async () => {
      const [characters, combos] = await db.transaction(
        'r',
        [db.characters, db.combos],
        () => Promise.all([db.characters.toArray(), db.combos.toArray()]),
      );

      return { characters, combos };
    },
  },

  demoVideos: {
    get: async (id: string) => db.demoVideos.get(id),
    add: async (video: DemoVideo) => {
      await db.demoVideos.add(video);
      return video.id;
    },
    delete: async (id: string) => db.demoVideos.delete(id),
    getAll: () => db.demoVideos.toArray(),
    getBlobUrl: async (id: string) => {
      const video = await db.demoVideos.get(id);
      if (!video) return null;
      const blob = new Blob([video.data], { type: video.mimeType });
      return URL.createObjectURL(blob);
    },
  },

  export: async (
    includeVideos = false,
    filter?: {
      gameIds?: string[];
      characterIds?: string[];
      comboIds?: string[];
    },
    onProgress?: (current: number, total: number) => void,
  ) => {
    let [games, characters, combos, settings] = await db.transaction(
      'r',
      [db.games, db.characters, db.combos, db.settings],
      () =>
        Promise.all([
          db.games.toArray(),
          db.characters.toArray(),
          db.combos.toArray(),
          db.settings.get(1),
        ]),
    );

    if (filter) {
      if (filter.gameIds) {
        const gameIdSet = new Set(filter.gameIds);
        games = games.filter((g) => gameIdSet.has(g.id));
      }
      if (filter.characterIds) {
        const charIdSet = new Set(filter.characterIds);
        characters = characters.filter((c) => charIdSet.has(c.id));
      }
      if (filter.comboIds) {
        const comboIdSet = new Set(filter.comboIds);
        combos = combos.filter((c) => comboIdSet.has(c.id));
      }
    }

    let sanitizedCombos = combos;

    if (includeVideos) {
      const localVideoIds = new Set(collectLocalVideoIds(combos));
      const allVideos = await db.demoVideos.toArray();
      const filteredVideos = allVideos.filter((v) => localVideoIds.has(v.id));

      sanitizedCombos = sanitizeCombosLocalVideos(
        combos,
        new Set(filteredVideos.map((v) => v.id)),
      );

      const zip = new JSZip();
      const demoVideos = filteredVideos.map((video) => {
        const extMatch = /\.[^.]+$/.exec(video.fileName);
        const ext = extMatch?.[0] ?? '';
        return {
          id: video.id,
          fileName: video.fileName,
          mimeType: video.mimeType,
          path: `${ZIP_BACKUP_VIDEO_DIR}/${video.id}${ext}`,
        };
      });

      onProgress?.(0, filteredVideos.length);
      for (let i = 0; i < filteredVideos.length; i++) {
        const video = filteredVideos[i];
        const entry = demoVideos[i];
        zip.file(entry.path, new Uint8Array(video.data));
        onProgress?.(i + 1, filteredVideos.length);
        if (i < filteredVideos.length - 1) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      }

      zip.file(
        ZIP_BACKUP_METADATA_FILE,
        JSON.stringify(
          {
            version: 3,
            exported: new Date().toISOString(),
            games,
            characters,
            combos: sanitizedCombos,
            settings,
            demoVideos,
          },
          null,
          2,
        ),
      );

      return zip.generateAsync({
        type: 'blob',
        // Demo videos are already compressed; STORE avoids costly recompression.
        compression: 'STORE',
      });
    }

    sanitizedCombos = sanitizeCombosLocalVideos(combos, new Set());
    return new Blob(
      [
        JSON.stringify(
          {
            version: 1,
            exported: new Date().toISOString(),
            games,
            characters,
            combos: sanitizedCombos,
            settings,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
  },

  import: async (
    data: string,
    includeVideos = false,
    includeSettings = false,
  ) => {
    let json: unknown;
    try {
      json = JSON.parse(data);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(
          'Backup JSON is incomplete or too large to parse. Re-export with fewer videos.',
        );
      }
      throw error;
    }
    const parsed = importDataSchema.parse(json);
    if (parsed.version === 3) {
      throw new Error(
        'Version 3 backups with videos must be imported from zip.',
      );
    }
    // Validate individual video sizes. base64 encodes 3 bytes as 4 chars, so
    // decoded byte length ≈ base64Length * 0.75.
    if (parsed.demoVideos) {
      for (const v of parsed.demoVideos) {
        if (!v.dataBase64) {
          throw new Error(
            `Video "${v.fileName}" is missing embedded dataBase64 payload`,
          );
        }
        const decodedBytes = Math.ceil(v.dataBase64.length * 0.75);
        if (decodedBytes > MAX_VIDEO_SIZE_BYTES) {
          throw new Error(
            `Video "${v.fileName}" exceeds the 50 MB per-video limit`,
          );
        }
      }
    }

    const availableVideoIds = includeVideos
      ? new Set((parsed.demoVideos ?? []).map((video) => video.id))
      : new Set<string>();
    const sanitizedCombos = parsed.combos
      ? sanitizeCombosLocalVideos(parsed.combos, availableVideoIds)
      : undefined;

    const gameIds = new Set((parsed.games ?? []).map((game) => game.id));
    const characterIds = new Set(
      (parsed.characters ?? []).map((character) => character.id),
    );
    const orphanedCharacters = (parsed.characters ?? []).filter(
      (character) => !gameIds.has(character.gameId),
    );
    const orphanedCombos = (sanitizedCombos ?? []).filter(
      (combo) => !characterIds.has(combo.characterId),
    );
    if (orphanedCharacters.length > 0 || orphanedCombos.length > 0) {
      throw new Error(
        `Import has referential integrity issues: ${orphanedCharacters.length} orphaned characters, ${orphanedCombos.length} orphaned combos`,
      );
    }

    await db.transaction(
      'rw',
      [db.games, db.characters, db.combos, db.settings, db.demoVideos],
      async () => {
        if (parsed.games) {
          for (const game of parsed.games) {
            await db.games.put(game);
          }
        }
        if (parsed.characters) {
          for (const character of parsed.characters) {
            await db.characters.put(character);
          }
        }
        if (sanitizedCombos) {
          for (const combo of sanitizedCombos) {
            await db.combos.put(combo);
          }
        }
        if (includeSettings && parsed.settings) {
          await db.settings.put({
            id: 1,
            ...parsed.settings,
          });
        }
        if (includeVideos && parsed.demoVideos) {
          for (const v of parsed.demoVideos) {
            if (!v.dataBase64) {
              throw new Error(
                `Video "${v.fileName}" is missing embedded dataBase64 payload`,
              );
            }
            await db.demoVideos.put({
              id: v.id,
              fileName: v.fileName,
              mimeType: v.mimeType,
              data: base64ToArrayBuffer(v.dataBase64),
            });
          }
        }
      },
    );
  },

  importZip: async (
    file: Blob,
    includeVideos = false,
    includeSettings = false,
    onProgress?: (progress: ZipImportProgress) => void,
  ) => {
    onProgress?.({ phase: 'loading', current: 0, total: null });
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const metadataFile = zip.file(ZIP_BACKUP_METADATA_FILE);
    if (!metadataFile) {
      throw new Error('Invalid backup zip: missing backup.json');
    }

    const metadataText = await metadataFile.async('string');
    let json: unknown;
    try {
      json = JSON.parse(metadataText);
    } catch {
      throw new Error('Invalid backup zip: backup.json is not valid JSON');
    }

    const parsed = importDataSchema.parse(json);
    if (parsed.version !== 3) {
      // Backward-compatible: if someone zipped an old JSON backup, import it.
      await indexedDbStorage.import(
        metadataText,
        includeVideos,
        includeSettings,
      );
      return;
    }

    const videosToImport: DemoVideo[] = [];
    if (includeVideos && parsed.demoVideos) {
      onProgress?.({
        phase: 'videos',
        current: 0,
        total: parsed.demoVideos.length,
      });

      for (const v of parsed.demoVideos) {
        let buffer: ArrayBuffer;
        if (v.path) {
          const zipEntry = zip.file(v.path);
          if (!zipEntry) {
            throw new Error(
              `Video "${v.fileName}" is missing from the backup zip`,
            );
          }
          buffer = await zipEntry.async('arraybuffer');
        } else if (v.dataBase64) {
          buffer = base64ToArrayBuffer(v.dataBase64);
        } else {
          throw new Error(
            `Video "${v.fileName}" is missing path and data payload`,
          );
        }

        if (buffer.byteLength > MAX_VIDEO_SIZE_BYTES) {
          throw new Error(
            `Video "${v.fileName}" exceeds the 50 MB per-video limit`,
          );
        }

        videosToImport.push({
          id: v.id,
          fileName: v.fileName,
          mimeType: v.mimeType,
          data: buffer,
        });

        onProgress?.({
          phase: 'videos',
          current: videosToImport.length,
          total: parsed.demoVideos.length,
        });
      }
    }

    onProgress?.({
      phase: 'finalizing',
      current: videosToImport.length,
      total: includeVideos ? (parsed.demoVideos?.length ?? 0) : null,
    });

    const availableVideoIds = includeVideos
      ? new Set(videosToImport.map((video) => video.id))
      : new Set<string>();
    const sanitizedCombos = parsed.combos
      ? sanitizeCombosLocalVideos(parsed.combos, availableVideoIds)
      : undefined;

    const gameIds = new Set((parsed.games ?? []).map((game) => game.id));
    const characterIds = new Set(
      (parsed.characters ?? []).map((character) => character.id),
    );
    const orphanedCharacters = (parsed.characters ?? []).filter(
      (character) => !gameIds.has(character.gameId),
    );
    const orphanedCombos = (sanitizedCombos ?? []).filter(
      (combo) => !characterIds.has(combo.characterId),
    );
    if (orphanedCharacters.length > 0 || orphanedCombos.length > 0) {
      throw new Error(
        `Import has referential integrity issues: ${orphanedCharacters.length} orphaned characters, ${orphanedCombos.length} orphaned combos`,
      );
    }

    await db.transaction(
      'rw',
      [db.games, db.characters, db.combos, db.settings, db.demoVideos],
      async () => {
        if (parsed.games) {
          for (const game of parsed.games) {
            await db.games.put(game);
          }
        }
        if (parsed.characters) {
          for (const character of parsed.characters) {
            await db.characters.put(character);
          }
        }
        if (sanitizedCombos) {
          for (const combo of sanitizedCombos) {
            await db.combos.put(combo);
          }
        }
        if (includeSettings && parsed.settings) {
          await db.settings.put({
            id: 1,
            ...parsed.settings,
          });
        }
        if (includeVideos) {
          for (const video of videosToImport) {
            await db.demoVideos.put(video);
          }
        }
      },
    );
  },
};

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export { db };
