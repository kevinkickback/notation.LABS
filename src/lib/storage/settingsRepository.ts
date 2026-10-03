import { DEFAULT_SETTINGS } from '@/lib/defaults';
import type { NotationColors, UserSettings } from '@/lib/types';
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

export const settingsRepository = {
  get: async (): Promise<UserSettings> => {
    const settings = await db.settings.get(1);
    if (!settings) return DEFAULT_SETTINGS;
    const { id: _id, ...rest } = settings;
    // Merge new defaults so existing settings rows gain newly introduced
    // preferences without requiring a schema-version migration.
    return { ...DEFAULT_SETTINGS, ...(await normalizeNotebookSettings(rest)) };
  },
  init: async (): Promise<void> => {
    await db.transaction(
      'rw',
      [db.settings, db.games, db.characters],
      async () => {
        let settings = await db.settings.get(1);
        if (!settings) {
          await db.settings.add({ id: 1, ...DEFAULT_SETTINGS });
          settings = { id: 1, ...DEFAULT_SETTINGS };
        }
        const needsNotebookMigration =
          settings.notebookOpenPages === undefined ||
          settings.notesDefaultOpen !== undefined ||
          settings.notesOverrides !== undefined;
        const { colors, changed } = migrateNotationColors(
          settings.notationColors,
        );
        if (needsNotebookMigration || changed) {
          await db.settings.put({
            ...(await normalizeNotebookSettings(settings)),
            id: 1,
            ...(changed ? { notationColors: colors as NotationColors } : {}),
          });
        }
      },
    );
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
