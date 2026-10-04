import { encodeBackupRecord } from '@/lib/backup/capabilities';
import { db } from './database';

export function generateId(): string {
  return crypto.randomUUID();
}

export function toUniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

export async function setEntityFavorite(
  table: typeof db.games | typeof db.characters,
  id: string,
  favorite: boolean,
): Promise<void> {
  await db.transaction('rw', table, async () => {
    const current = await table.get(id);
    if (current) encodeBackupRecord({ ...current, favorite });
    await table.update(id, { favorite });
  });
}
