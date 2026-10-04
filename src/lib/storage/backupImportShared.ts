import Dexie from 'dexie';
import type { BackupImportPlan } from '@/lib/backup/importPipeline';
import { haveSameGameNotation } from '@/lib/comboParsing';
import { COMBO_NOTATION_PARSER_VERSION } from '@/lib/parser';
import type { Combo } from '@/lib/types';
import {
  collectUnusedPayloads,
  createBackupSession,
  finishBackupSession,
  stageBackupRecord,
  stagedRecordBatches,
  stagedRecordId,
} from './backupSessionRepository';
import { db } from './database';
import { parseStoredCombo } from './notationMaintenance';
import { recordBatches } from './recordBatches';
import {
  normalizeNotebookSettings,
  settingsRepository,
} from './settingsRepository';
import { stageVideoPayload } from './videoRepository';

/** All external I/O and decoding have completed. Only small record writes publish here. */
export async function publishBackupSession(sessionId: string): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.games,
      db.characters,
      db.combos,
      db.settings,
      db.demoVideos,
      db.mediaPayloads,
      db.backupRecords,
      db.backupSessions,
    ],
    async () => {
      const session = await db.backupSessions.get(sessionId);
      if (!session || session.kind !== 'import' || session.state !== 'staging')
        throw new Error('Backup import session is unavailable');
      const saved = await db.settings.get(1);
      for await (const batch of stagedRecordBatches(sessionId, 'games')) {
        for (const game of batch) {
          const previous = await db.games.get(game.id);
          if (!previous || !haveSameGameNotation(previous, game))
            await db.backupRecords.update(
              stagedRecordId(sessionId, 'games', game.id),
              { notationChanged: true },
            );
        }
        await db.games.bulkPut(batch);
      }
      for await (const batch of stagedRecordBatches(sessionId, 'characters')) {
        for (const character of batch) {
          const previous = await db.characters.get(character.id);
          if (previous?.gameId !== character.gameId)
            await db.backupRecords.update(
              stagedRecordId(sessionId, 'characters', character.id),
              { notationChanged: true },
            );
        }
        await db.characters.bulkPut(batch);
      }
      for await (const batch of stagedRecordBatches(sessionId, 'combos'))
        await db.combos.bulkPut(batch);
      if (session.includeVideos !== false)
        for await (const batch of stagedRecordBatches(sessionId, 'videos')) {
          // Read reference keys only; old ArrayBuffer records must not be loaded in bulk.
          const previous = await db.demoVideos
            .where('[id+payloadId]')
            .inAnyRange(
              batch.map((video) => [
                [video.id, Dexie.minKey],
                [video.id, Dexie.maxKey],
              ]),
            )
            .keys();
          await db.demoVideos.bulkPut(batch);
          await collectUnusedPayloads(
            previous.flatMap((key) =>
              Array.isArray(key) && typeof key[1] === 'string' ? [key[1]] : [],
            ),
          );
        }
      if (session.settings)
        await db.settings.put({
          ...(await normalizeNotebookSettings(session.settings)),
          id: 1,
          parsedNotationVersion: saved?.parsedNotationVersion ?? 0,
        });
      await settingsRepository.init();
      for await (const batch of recordBatches(db.combos)) {
        const changed: Combo[] = [];
        const imported = await db.backupRecords.bulkGet(
          batch.map((combo) => stagedRecordId(sessionId, 'combos', combo.id)),
        );
        for (const [index, combo] of batch.entries()) {
          if (imported[index]) continue;
          let reparse =
            saved?.parsedNotationVersion !== COMBO_NOTATION_PARSER_VERSION;
          if (!reparse) {
            const characterChange = await db.backupRecords.get(
              stagedRecordId(sessionId, 'characters', combo.characterId),
            );
            const character = await db.characters.get(combo.characterId);
            const gameChange = character
              ? await db.backupRecords.get(
                  stagedRecordId(sessionId, 'games', character.gameId),
                )
              : undefined;
            reparse = !!(
              characterChange?.notationChanged || gameChange?.notationChanged
            );
          }
          if (reparse) changed.push(await parseStoredCombo(combo));
        }
        if (changed.length) await db.combos.bulkPut(changed);
      }
      const settings = await db.settings.get(1);
      if (
        settings &&
        settings.parsedNotationVersion !== COMBO_NOTATION_PARSER_VERSION
      )
        await db.settings.put({
          ...settings,
          parsedNotationVersion: COMBO_NOTATION_PARSER_VERSION,
        });
      await db.backupSessions.update(sessionId, { state: 'committed' });
    },
  );
}

/** Compatibility adapter: old JSON is already bounded by its whole-document allocation budget. */
export async function applyBackupImportPlan(
  plan: BackupImportPlan,
  options: { signal?: AbortSignal; onCommitting?: () => void } = {},
): Promise<void> {
  const sessionId = plan.sessionId ?? (await createBackupSession('import')).id;
  try {
    for (const game of plan.games) {
      options.signal?.throwIfAborted();
      await stageBackupRecord(sessionId, 'games', game);
    }
    for (const character of plan.characters) {
      options.signal?.throwIfAborted();
      await stageBackupRecord(sessionId, 'characters', character);
    }
    for (const combo of plan.combos) {
      options.signal?.throwIfAborted();
      await stageBackupRecord(sessionId, 'combos', combo);
    }
    for (const video of plan.videos) {
      options.signal?.throwIfAborted();
      const reference =
        'data' in video ? await stageVideoPayload(video, sessionId) : video;
      await stageBackupRecord(sessionId, 'videos', reference);
    }
    options.signal?.throwIfAborted();
    await db.backupSessions.update(sessionId, { settings: plan.settings });
    options.signal?.throwIfAborted();
    options.onCommitting?.();
    await publishBackupSession(sessionId);
  } finally {
    if (!plan.sessionId) await finishBackupSession(sessionId);
  }
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++)
    bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}
