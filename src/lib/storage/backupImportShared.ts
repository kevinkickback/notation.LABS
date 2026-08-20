import type { BackupImportPlan } from '@/lib/backup/importPipeline';
import { db } from './database';
import {
  markImportedCombosForReparse,
  settingsRepository,
} from './settingsRepository';

export async function applyBackupImportPlan(
  plan: BackupImportPlan,
): Promise<void> {
  await db.transaction(
    'rw',
    [db.games, db.characters, db.combos, db.settings, db.demoVideos],
    async () => {
      await db.games.bulkPut(plan.games);
      await db.characters.bulkPut(plan.characters);
      await db.combos.bulkPut(plan.combos);
      if (plan.settings) await db.settings.put({ id: 1, ...plan.settings });
      await db.demoVideos.bulkPut(plan.videos);
      if (plan.combos.length > 0) await markImportedCombosForReparse();
    },
  );

  if (plan.combos.length > 0) await settingsRepository.init();
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}
