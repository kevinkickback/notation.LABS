import { encodeBackupRecord } from '@/lib/backup/capabilities';
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
    const record = {
      ...character,
      id,
      createdAt: now,
      updatedAt: now,
    };
    encodeBackupRecord(record);
    await db.characters.add(record);
    return id;
  },
  update: async (id: string, updates: Partial<Character>) => {
    await db.transaction('rw', db.characters, async () => {
      const current = await db.characters.get(id);
      const updatedAt = Date.now();
      if (current) encodeBackupRecord({ ...current, ...updates, updatedAt });
      await db.characters.update(id, { ...updates, updatedAt });
    });
  },
  setFavorite: async (id: string, favorite: boolean) => {
    await db.characters.update(id, { favorite });
  },
  delete: (id: string) => deleteEntityCascade('character', [id]),
  bulkDelete: (ids: string[]) => deleteEntityCascade('character', ids),
};
