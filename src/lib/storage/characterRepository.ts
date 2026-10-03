import type { Character } from '@/lib/types';
import { db } from './database';
import { deleteEntityCascade } from './entityDeletion';
import { generateId } from './repositoryUtils';

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
  delete: (id: string) => deleteEntityCascade('character', [id]),
  bulkDelete: (ids: string[]) => deleteEntityCascade('character', ids),
};
