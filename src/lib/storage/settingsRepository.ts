import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { resolveNotationProfile } from '@/lib/notationProfiles';
import {
  COMBO_NOTATION_PARSER_VERSION,
  parseComboNotation,
} from '@/lib/parser';
import type { Game, NotationColors, UserSettings } from '@/lib/types';
import { db } from './database';
import { toUniqueIds } from './repositoryUtils';

export async function normalizeNotebookSettings(
  settings: UserSettings,
): Promise<UserSettings> {
  const { notesDefaultOpen, notesOverrides = [], ...current } = settings;
  let openPages = current.notebookOpenPages;
  if (openPages === undefined) {
    if (notesDefaultOpen) {
      const [games, characters] = await Promise.all([
        db.games.toCollection().primaryKeys(),
        db.characters.toCollection().primaryKeys(),
      ]);
      const closedPages = new Set(notesOverrides);
      openPages = [...games, ...characters].filter(
        (id) => !closedPages.has(id),
      );
    } else {
      openPages = notesOverrides;
    }
  }
  return { ...current, notebookOpenPages: toUniqueIds(openPages) };
}

async function updateNotebookOpenPages(
  update: (openPages: string[]) => string[],
): Promise<void> {
  await db.transaction(
    'rw',
    [db.settings, db.games, db.characters],
    async () => {
      const saved = await db.settings.get(1);
      const current = saved
        ? await normalizeNotebookSettings(saved)
        : DEFAULT_SETTINGS;
      await db.settings.put({
        ...current,
        id: 1,
        notebookOpenPages: toUniqueIds(update(current.notebookOpenPages ?? [])),
      });
    },
  );
}

const OKLCH_TO_HEX: Record<string, string> = {
  'oklch(0.85 0.05 265)': '#bdceef',
  'oklch(0.55 0.02 265)': '#6c727e',
};

function migrateNotationColors(colors: Record<string, string>): {
  colors: Record<string, string>;
  changed: boolean;
} {
  const migrated = { ...colors };
  let changed = false;
  for (const key of Object.keys(colors)) {
    const value = colors[key];
    if (typeof value === 'string' && value.startsWith('oklch(')) {
      const fallback =
        key in DEFAULT_SETTINGS.notationColors
          ? (DEFAULT_SETTINGS.notationColors as Record<string, string>)[key]
          : '#bdceef';
      migrated[key] = OKLCH_TO_HEX[value] ?? fallback;
      changed = true;
    }
  }
  return { colors: migrated, changed };
}

export async function reparseCombosForGame(
  gameId: string,
  buttonLayout: string[],
  notationProfile: Game['notationProfile'],
): Promise<void> {
  const characters = await db.characters
    .where('gameId')
    .equals(gameId)
    .toArray();
  const characterIds = characters.map((character) => character.id);
  if (characterIds.length === 0) return;

  const combos = await db.combos
    .where('characterId')
    .anyOf(characterIds)
    .toArray();
  if (combos.length === 0) return;

  await db.combos.bulkPut(
    combos.map((combo) => ({
      ...combo,
      parsedNotation: parseComboNotation(combo.notation, buttonLayout, {
        profile: notationProfile,
      }),
    })),
  );
}

async function reparseStoredCombos(): Promise<void> {
  const [games, characters, combos] = await Promise.all([
    db.games.toArray(),
    db.characters.toArray(),
    db.combos.toArray(),
  ]);
  if (combos.length === 0) return;

  const gameButtonsById = new Map(
    games.map((game) => [game.id, game.buttonLayout]),
  );
  const gameProfileById = new Map(
    games.map((game) => [game.id, resolveNotationProfile(game)]),
  );
  const characterGameById = new Map(
    characters.map((character) => [character.id, character.gameId]),
  );

  await db.combos.bulkPut(
    combos.map((combo) => {
      const gameId = characterGameById.get(combo.characterId);
      return {
        ...combo,
        parsedNotation: parseComboNotation(
          combo.notation,
          gameId ? gameButtonsById.get(gameId) : undefined,
          { profile: gameId ? gameProfileById.get(gameId) : undefined },
        ),
      };
    }),
  );
}

export async function markImportedCombosForReparse(): Promise<void> {
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

export const settingsRepository = {
  get: async (): Promise<UserSettings> => {
    const settings = await db.settings.get(1);
    if (!settings) return DEFAULT_SETTINGS;
    const { id: _id, ...rest } = settings;
    // Merge new defaults so existing settings rows gain newly introduced
    // preferences without requiring a schema-version migration.
    return { ...DEFAULT_SETTINGS, ...(await normalizeNotebookSettings(rest)) };
  },
  init: async (options?: {
    onReparseStart?: () => void;
    onReparseEnd?: () => void;
  }): Promise<void> => {
    let settings = await db.settings.get(1);
    if (!settings) {
      await db.settings.add({ id: 1, ...DEFAULT_SETTINGS });
      settings = { id: 1, ...DEFAULT_SETTINGS };
    }

    if (
      settings.notebookOpenPages === undefined ||
      settings.notesDefaultOpen !== undefined ||
      settings.notesOverrides !== undefined
    ) {
      settings = { ...(await normalizeNotebookSettings(settings)), id: 1 };
      await db.settings.put(settings);
    }

    const pendingSettingsUpdates: Partial<UserSettings> = {};
    const { colors, changed } = migrateNotationColors(settings.notationColors);
    if (changed)
      pendingSettingsUpdates.notationColors = colors as NotationColors;

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
  setNotebookOpen: async (entityId: string, isOpen: boolean): Promise<void> => {
    await updateNotebookOpenPages((pages) =>
      isOpen ? [...pages, entityId] : pages.filter((id) => id !== entityId),
    );
  },
  removeNotebookOpenPages: async (entityIds: string[]): Promise<void> => {
    const uniqueIds = toUniqueIds(entityIds);
    if (uniqueIds.length === 0) return;

    const idsToRemove = new Set(uniqueIds);
    await updateNotebookOpenPages((pages) =>
      pages.filter((id) => !idsToRemove.has(id)),
    );
  },
};
