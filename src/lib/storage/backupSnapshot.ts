import type { BackupSnapshot } from '@/lib/backup/exportContract';
import {
  type BackupFilter,
  closeBackupSelection,
} from '@/lib/backup/selectionClosure';
import { settingsSchema } from '@/lib/schemas';
import { db } from './database';
import { collectLocalVideoIds } from './videoRepository';

/** Read related records together, without loading any video buffers. */
export async function loadBackupSnapshot(
  filter?: BackupFilter,
): Promise<BackupSnapshot> {
  const [games, characters, combos, settings, availableVideoIds] =
    await db.transaction(
      'r',
      [db.games, db.characters, db.combos, db.settings, db.demoVideos],
      () =>
        Promise.all([
          db.games.toArray(),
          db.characters.toArray(),
          db.combos.toArray(),
          db.settings.get(1),
          db.demoVideos.toCollection().primaryKeys(),
        ]),
    );
  const records = {
    ...closeBackupSelection({ games, characters, combos }, filter),
    settings: settings ? settingsSchema.parse(settings) : undefined,
  };
  const available = new Set(availableVideoIds);
  return {
    records,
    videoIds: collectLocalVideoIds(records.combos).filter((id) =>
      available.has(id),
    ),
  };
}
