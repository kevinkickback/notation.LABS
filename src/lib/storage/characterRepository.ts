import type { Character } from '@/lib/types';
import { db } from './database';
import { generateId, toUniqueIds } from './repositoryUtils';
import { settingsRepository } from './settingsRepository';
import {
  collectLocalVideoIds,
  deleteUnreferencedLocalVideos,
} from './videoRepository';

export const characterRepository = {
  getAll: () => db.characters.toArray(),
  getByGame: (gameId: string) =>
    db.characters.where('gameId').equals(gameId).toArray(),
  get: (id: string) => db.characters.get(id),
  add: async (character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => {
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
    await db.characters.update(id, { ...updates, updatedAt: Date.now() });
  },
  setFavorite: async (id: string, favorite: boolean) => {
    await db.characters.update(id, { favorite });
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
    await settingsRepository.removeNotesOverride(id);
  },
  bulkDelete: async (ids: string[]) => {
    const uniqueIds = toUniqueIds(ids);
    if (uniqueIds.length === 0) return;

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
    await settingsRepository.removeNotesOverrides(uniqueIds);
  },
};
