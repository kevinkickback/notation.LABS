import Dexie, { type EntityTable } from 'dexie';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';
import {
  type BackupImportPlan,
  normalizeBackupImport,
} from '../backup/importPipeline';
import {
  type BackupFilter,
  closeBackupSelection,
} from '../backup/selectionClosure';
import {
  DEFAULT_SETTINGS,
  MAX_BACKUP_ENTRY_COUNT,
  MAX_BACKUP_METADATA_BYTES,
  MAX_BACKUP_UNCOMPRESSED_BYTES,
  MAX_BACKUP_VIDEO_BYTES,
  MAX_BACKUP_VIDEO_COUNT,
  MAX_JSON_BACKUP_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  MAX_ZIP_BACKUP_BYTES,
} from '../defaults';
import {
  migrateLegacyNotationProfile,
  resolveNotationProfile,
} from '../notationProfiles';
import { COMBO_NOTATION_PARSER_VERSION, parseComboNotation } from '../parser';
import { importDataSchema } from '../schemas';
import type {
  Character,
  Combo,
  Game,
  LegacyGame,
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

interface ZipEntryMetadata {
  uncompressedSize: number;
}

async function inspectZipCentralDirectory(
  file: Blob,
): Promise<Map<string, ZipEntryMetadata>> {
  const endRecordSize = 22;
  const maxCommentSize = 65_535;
  if (file.size < endRecordSize) {
    throw new Error('Invalid backup zip: end record not found');
  }

  const tailStart = Math.max(0, file.size - endRecordSize - maxCommentSize);
  const tail = await file.slice(tailStart).arrayBuffer();
  const tailView = new DataView(tail);
  let endRecordOffset = -1;
  for (let offset = tail.byteLength - endRecordSize; offset >= 0; offset--) {
    if (tailView.getUint32(offset, true) === 0x06054b50) {
      const commentLength = tailView.getUint16(offset + 20, true);
      if (offset + endRecordSize + commentLength === tail.byteLength) {
        endRecordOffset = offset;
        break;
      }
    }
  }
  if (endRecordOffset < 0) {
    throw new Error('Invalid backup zip: end record not found');
  }

  const diskNumber = tailView.getUint16(endRecordOffset + 4, true);
  const directoryDisk = tailView.getUint16(endRecordOffset + 6, true);
  const diskEntryCount = tailView.getUint16(endRecordOffset + 8, true);
  const entryCount = tailView.getUint16(endRecordOffset + 10, true);
  const directorySize = tailView.getUint32(endRecordOffset + 12, true);
  const directoryOffset = tailView.getUint32(endRecordOffset + 16, true);
  if (
    diskNumber !== 0 ||
    directoryDisk !== 0 ||
    diskEntryCount !== entryCount ||
    entryCount === 0xffff ||
    directorySize === 0xffffffff ||
    directoryOffset === 0xffffffff
  ) {
    throw new Error('Unsupported multi-volume or ZIP64 backup');
  }
  if (entryCount > MAX_BACKUP_ENTRY_COUNT) {
    throw new Error(
      `Backup zip contains more than ${MAX_BACKUP_ENTRY_COUNT} files`,
    );
  }
  if (directorySize > MAX_BACKUP_METADATA_BYTES) {
    throw new Error('Backup zip central directory exceeds the size limit');
  }
  if (directoryOffset + directorySize > file.size) {
    throw new Error('Invalid backup zip: central directory is out of bounds');
  }

  const directory = await file
    .slice(directoryOffset, directoryOffset + directorySize)
    .arrayBuffer();
  const directoryView = new DataView(directory);
  const decoder = new TextDecoder();
  const entries = new Map<string, ZipEntryMetadata>();
  let offset = 0;
  let totalUncompressedBytes = 0;
  for (let index = 0; index < entryCount; index++) {
    if (
      offset + 46 > directory.byteLength ||
      directoryView.getUint32(offset, true) !== 0x02014b50
    ) {
      throw new Error('Invalid backup zip: malformed central directory');
    }
    const uncompressedSize = directoryView.getUint32(offset + 24, true);
    const fileNameLength = directoryView.getUint16(offset + 28, true);
    const extraLength = directoryView.getUint16(offset + 30, true);
    const commentLength = directoryView.getUint16(offset + 32, true);
    const nextOffset =
      offset + 46 + fileNameLength + extraLength + commentLength;
    if (nextOffset > directory.byteLength || uncompressedSize === 0xffffffff) {
      throw new Error('Invalid backup zip: malformed or ZIP64 entry');
    }

    const name = decoder.decode(
      new Uint8Array(directory, offset + 46, fileNameLength),
    );
    if (entries.has(name)) {
      throw new Error(`Backup zip contains duplicate file "${name}"`);
    }
    entries.set(name, { uncompressedSize });
    totalUncompressedBytes += uncompressedSize;
    if (totalUncompressedBytes > MAX_BACKUP_UNCOMPRESSED_BYTES) {
      throw new Error('Backup zip exceeds the uncompressed size limit');
    }
    offset = nextOffset;
  }

  if (offset !== directory.byteLength) {
    throw new Error('Invalid backup zip: central directory size mismatch');
  }
  return entries;
}

function validatePendingVideoReference(
  demoUrl: string | undefined,
  video: DemoVideo | undefined,
): void {
  if (!video) return;
  if (video.data.byteLength > MAX_VIDEO_SIZE_BYTES) {
    throw new Error(`Video "${video.fileName}" exceeds the 50 MB limit`);
  }
  if (getLocalVideoId(demoUrl) !== video.id) {
    throw new Error('Pending video does not match the combo demo URL');
  }
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

db.version(6)
  .stores({
    games: 'id, name, createdAt',
    characters: 'id, gameId, name, createdAt',
    combos:
      'id, characterId, name, notation, description, createdAt, updatedAt, *tags, sortOrder',
    settings: 'id',
    demoVideos: 'id',
  })
  .upgrade((tx) =>
    tx
      .table('games')
      .toCollection()
      .modify((game: LegacyGame) => migrateLegacyNotationProfile(game)),
  );

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

async function deleteUnreferencedLocalVideos(
  candidateIds: string[],
): Promise<void> {
  const uniqueCandidateIds = toUniqueIds(candidateIds);
  if (uniqueCandidateIds.length === 0) {
    return;
  }

  const referencedIds = new Set(
    collectLocalVideoIds(await db.combos.toArray()),
  );
  const unreferencedIds = uniqueCandidateIds.filter(
    (id) => !referencedIds.has(id),
  );
  if (unreferencedIds.length > 0) {
    await db.demoVideos.bulkDelete(unreferencedIds);
  }
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

function areStringArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

async function reparseCombosForGame(
  gameId: string,
  buttonLayout: string[],
  notationProfile: Game['notationProfile'],
): Promise<void> {
  const characters = await db.characters
    .where('gameId')
    .equals(gameId)
    .toArray();
  const characterIds = characters.map((character) => character.id);

  if (characterIds.length === 0) {
    return;
  }

  const combos = await db.combos
    .where('characterId')
    .anyOf(characterIds)
    .toArray();
  if (combos.length === 0) {
    return;
  }

  const reparsedCombos = combos.map((combo) => ({
    ...combo,
    parsedNotation: parseComboNotation(combo.notation, buttonLayout, {
      profile: notationProfile,
    }),
  }));

  await db.combos.bulkPut(reparsedCombos);
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
  const gameProfileById = new Map<string, Game['notationProfile']>();
  for (const game of games) {
    gameButtonsById.set(game.id, game.buttonLayout);
    gameProfileById.set(game.id, resolveNotationProfile(game));
  }

  const characterGameById = new Map<string, string>();
  for (const character of characters) {
    characterGameById.set(character.id, character.gameId);
  }

  const reparsedCombos = combos.map((combo) => {
    const gameId = characterGameById.get(combo.characterId);
    const customButtons = gameId ? gameButtonsById.get(gameId) : undefined;
    const notationProfile = gameId ? gameProfileById.get(gameId) : undefined;

    return {
      ...combo,
      parsedNotation: parseComboNotation(combo.notation, customButtons, {
        profile: notationProfile,
      }),
    };
  });

  await db.combos.bulkPut(reparsedCombos);
}

async function markImportedCombosForReparse(): Promise<void> {
  const settings = await db.settings.get(1);

  if (!settings) {
    await db.settings.put({
      id: 1,
      ...DEFAULT_SETTINGS,
      parsedNotationVersion: 0,
    });
    return;
  }

  await db.settings.update(1, { parsedNotationVersion: 0 });
}

async function applyBackupImportPlan(plan: BackupImportPlan): Promise<void> {
  await db.transaction(
    'rw',
    [db.games, db.characters, db.combos, db.settings, db.demoVideos],
    async () => {
      await db.games.bulkPut(plan.games);
      await db.characters.bulkPut(plan.characters);
      await db.combos.bulkPut(plan.combos);
      if (plan.settings) {
        await db.settings.put({ id: 1, ...plan.settings });
      }
      await db.demoVideos.bulkPut(plan.videos);
      if (plan.combos.length > 0) await markImportedCombosForReparse();
    },
  );

  if (plan.combos.length > 0) await indexedDbStorage.settings.init();
}

export const indexedDbStorage = {
  games: {
    getAll: () => db.games.toArray(),
    get: (id: string) => db.games.get(id),
    add: async (
      game: Omit<Game, 'id' | 'createdAt' | 'updatedAt' | 'notationProfile'> & {
        notationProfile?: Game['notationProfile'];
      },
    ) => {
      const id = generateId();
      const now = Date.now();
      await db.games.add({
        ...game,
        notationProfile: resolveNotationProfile(game),
        id,
        createdAt: now,
        updatedAt: now,
      });
      return id;
    },
    update: async (id: string, updates: Partial<Game>) => {
      await db.transaction(
        'rw',
        [db.games, db.characters, db.combos],
        async () => {
          const currentGame = await db.games.get(id);
          const nextButtonLayout = updates.buttonLayout;
          const nextNotationProfile = updates.notationProfile;
          const shouldReparseCombos =
            currentGame !== undefined &&
            ((nextButtonLayout !== undefined &&
              !areStringArraysEqual(
                currentGame.buttonLayout,
                nextButtonLayout,
              )) ||
              (nextNotationProfile !== undefined &&
                nextNotationProfile !== resolveNotationProfile(currentGame)));

          await db.games.update(id, {
            ...updates,
            ...(nextNotationProfile
              ? { notationProfile: nextNotationProfile }
              : {}),
            updatedAt: Date.now(),
          });

          if (shouldReparseCombos) {
            const effectiveLayout =
              nextButtonLayout ?? currentGame.buttonLayout;
            const effectiveProfile =
              nextNotationProfile ?? resolveNotationProfile(currentGame);
            await reparseCombosForGame(id, effectiveLayout, effectiveProfile);
          }
        },
      );
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
            await db.combos.where('characterId').anyOf(characterIds).delete();
            await deleteUnreferencedLocalVideos(videoIds);
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
            await db.combos.where('characterId').anyOf(characterIds).delete();
            await deleteUnreferencedLocalVideos(videoIds);
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
          await db.combos.where('characterId').equals(id).delete();
          await deleteUnreferencedLocalVideos(videoIds);
          await db.characters.delete(id);
        },
      );
      await indexedDbStorage.settings.removeNotesOverride(id);
    },
    bulkDelete: async (ids: string[]) => {
      const uniqueIds = toUniqueIds(ids);
      if (uniqueIds.length === 0) {
        return;
      }

      await db.transaction(
        'rw',
        [db.characters, db.combos, db.demoVideos],
        async () => {
          const combos = await db.combos
            .where('characterId')
            .anyOf(uniqueIds)
            .toArray();
          const videoIds = collectLocalVideoIds(combos);
          await db.combos.where('characterId').anyOf(uniqueIds).delete();
          await deleteUnreferencedLocalVideos(videoIds);
          await db.characters.bulkDelete(uniqueIds);
        },
      );
      await indexedDbStorage.settings.removeNotesOverrides(uniqueIds);
    },
  },

  combos: {
    getAll: () => db.combos.toArray(),
    getByCharacter: (characterId: string) =>
      db.combos.where('characterId').equals(characterId).sortBy('sortOrder'),
    getByCharacters: async (characterIds: string[]): Promise<Combo[]> =>
      characterIds.length > 0
        ? await db.combos.where('characterId').anyOf(characterIds).toArray()
        : [],
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
    addWithVideo: async (
      combo: Omit<Combo, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'>,
      video?: DemoVideo,
    ) => {
      validatePendingVideoReference(combo.demoUrl, video);
      const id = generateId();
      const now = Date.now();
      await db.transaction('rw', [db.combos, db.demoVideos], async () => {
        const existing = await db.combos
          .where('characterId')
          .equals(combo.characterId)
          .toArray();
        const maxOrder = existing.reduce(
          (max, current) => Math.max(max, current.sortOrder ?? 0),
          -1,
        );
        if (video) {
          await db.demoVideos.add(video);
        }
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
    updateWithVideo: async (
      id: string,
      updates: Partial<Combo>,
      video?: DemoVideo,
    ) => {
      await db.transaction('rw', [db.combos, db.demoVideos], async () => {
        const current = await db.combos.get(id);
        if (!current) {
          throw new Error(`Combo "${id}" was not found`);
        }

        const nextDemoUrl =
          'demoUrl' in updates ? updates.demoUrl : current.demoUrl;
        validatePendingVideoReference(nextDemoUrl, video);

        if (video) {
          await db.demoVideos.add(video);
        }
        const updated = await db.combos.update(id, {
          ...updates,
          updatedAt: Date.now(),
        });
        if (updated !== 1) {
          throw new Error(`Combo "${id}" could not be updated`);
        }

        const previousVideoId = getLocalVideoId(current.demoUrl);
        const nextVideoId = getLocalVideoId(nextDemoUrl);
        if (previousVideoId && previousVideoId !== nextVideoId) {
          await deleteUnreferencedLocalVideos([previousVideoId]);
        }
      });
    },
    delete: async (id: string) => {
      await db.transaction('rw', [db.combos, db.demoVideos], async () => {
        const combo = await db.combos.get(id);
        const videoId = getLocalVideoId(combo?.demoUrl);
        await db.combos.delete(id);
        if (videoId) {
          await deleteUnreferencedLocalVideos([videoId]);
        }
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
        await db.combos.bulkDelete(uniqueIds);
        await deleteUnreferencedLocalVideos(videoIds);
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
      let settings = await db.settings.get(1);
      if (!settings) {
        await db.settings.add({ id: 1, ...DEFAULT_SETTINGS });
        settings = { id: 1, ...DEFAULT_SETTINGS };
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
    setNotesOverride: async (
      entityId: string,
      isOverride: boolean,
    ): Promise<void> => {
      await db.transaction('rw', db.settings, async () => {
        const settings = await db.settings.get(1);
        const currentOverrides = settings?.notesOverrides ?? [];
        const nextOverrides = isOverride
          ? toUniqueIds([...currentOverrides, entityId])
          : currentOverrides.filter((id) => id !== entityId);

        if (!settings) {
          await db.settings.add({
            id: 1,
            ...DEFAULT_SETTINGS,
            notesOverrides: nextOverrides,
          });
        } else if (nextOverrides.length !== currentOverrides.length) {
          await db.settings.update(1, { notesOverrides: nextOverrides });
        }
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
    filter?: BackupFilter,
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

    ({ games, characters, combos } = closeBackupSelection(
      { games, characters, combos },
      filter,
    ));

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
    if (data.length > MAX_JSON_BACKUP_BYTES) {
      throw new Error('Backup JSON exceeds the 100 MB import limit');
    }

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
    if ((parsed.demoVideos?.length ?? 0) > MAX_BACKUP_VIDEO_COUNT) {
      throw new Error(
        `Backup contains more than ${MAX_BACKUP_VIDEO_COUNT} videos`,
      );
    }
    let totalVideoBytes = 0;
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
        totalVideoBytes += decodedBytes;
        if (totalVideoBytes > MAX_BACKUP_VIDEO_BYTES) {
          throw new Error('Backup videos exceed the 500 MB aggregate limit');
        }
      }
    }

    const videos = includeVideos
      ? (parsed.demoVideos ?? []).map((video) => ({
          id: video.id,
          fileName: video.fileName,
          mimeType: video.mimeType,
          data: base64ToArrayBuffer(video.dataBase64 ?? ''),
        }))
      : [];
    await applyBackupImportPlan(
      normalizeBackupImport(parsed, { includeSettings, videos }),
    );
  },

  importZip: async (
    file: Blob,
    includeVideos = false,
    includeSettings = false,
    onProgress?: (progress: ZipImportProgress) => void,
  ) => {
    if (file.size > MAX_ZIP_BACKUP_BYTES) {
      throw new Error('Backup zip exceeds the 512 MB import limit');
    }

    onProgress?.({ phase: 'loading', current: 0, total: null });
    const archiveEntries = await inspectZipCentralDirectory(file);
    const zip = await JSZip.loadAsync(await file.arrayBuffer());

    const metadataFile = zip.file(ZIP_BACKUP_METADATA_FILE);
    const metadataEntry = archiveEntries.get(ZIP_BACKUP_METADATA_FILE);
    if (!metadataFile || !metadataEntry) {
      throw new Error('Invalid backup zip: missing backup.json');
    }
    if (metadataEntry.uncompressedSize > MAX_BACKUP_METADATA_BYTES) {
      throw new Error('Backup metadata exceeds the 10 MB import limit');
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

    if ((parsed.demoVideos?.length ?? 0) > MAX_BACKUP_VIDEO_COUNT) {
      throw new Error(
        `Backup contains more than ${MAX_BACKUP_VIDEO_COUNT} videos`,
      );
    }

    const videoIds = new Set<string>();
    const videoPaths = new Set<string>();
    let declaredVideoBytes = 0;
    for (const video of parsed.demoVideos ?? []) {
      if (videoIds.has(video.id)) {
        throw new Error(`Backup contains duplicate video id "${video.id}"`);
      }
      videoIds.add(video.id);

      let videoBytes = 0;
      if (video.path) {
        if (videoPaths.has(video.path)) {
          throw new Error(
            `Backup contains duplicate video path "${video.path}"`,
          );
        }
        videoPaths.add(video.path);
        const entry = archiveEntries.get(video.path);
        if (!entry || !zip.file(video.path)) {
          throw new Error(
            `Video "${video.fileName}" is missing from the backup zip`,
          );
        }
        videoBytes = entry.uncompressedSize;
      } else if (video.dataBase64) {
        videoBytes = Math.ceil(video.dataBase64.length * 0.75);
      }
      if (videoBytes > MAX_VIDEO_SIZE_BYTES) {
        throw new Error(
          `Video "${video.fileName}" exceeds the 50 MB per-video limit`,
        );
      }
      declaredVideoBytes += videoBytes;
      if (declaredVideoBytes > MAX_BACKUP_VIDEO_BYTES) {
        throw new Error('Backup videos exceed the 500 MB aggregate limit');
      }
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

    await applyBackupImportPlan(
      normalizeBackupImport(parsed, {
        includeSettings,
        videos: includeVideos ? videosToImport : [],
      }),
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
