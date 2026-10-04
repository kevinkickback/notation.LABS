import Dexie from 'dexie';
import { BACKUP_DIRECTORY_WORKING_BYTES } from '@/lib/backup/capabilities';
import type { BackupSnapshot } from '@/lib/backup/exportContract';
import {
  type BackupFilter,
  closeBackupSelection,
} from '@/lib/backup/selectionClosure';
import { settingsSchema } from '@/lib/schemas';
import {
  createBackupSession,
  finishBackupSession,
  stageBackupRecords,
  stagedRecordId,
} from './backupSessionRepository';
import { db } from './database';
import { projectRecords, recordBatches } from './recordBatches';
import { collectLocalVideoIds, resolveVideoReference } from './videoRepository';

export function readBackupSelection() {
  return db.transaction(
    'r',
    [db.games, db.characters, db.combos, db.demoVideos],
    () =>
      Promise.all([
        projectRecords(db.games, ({ id, name }) => ({ id, name })),
        projectRecords(db.characters, ({ id, name, gameId }) => ({
          id,
          name,
          gameId,
        })),
        projectRecords(db.combos, ({ id, name, characterId, demoUrl }) => ({
          id,
          name,
          characterId,
          demoUrl,
        })),
        db.demoVideos.count(),
      ]),
  );
}

export async function loadBackupSnapshot(
  filter?: BackupFilter,
  signal?: AbortSignal,
  includeVideos = true,
  onPreparing?: (current: number, total: number) => void,
): Promise<BackupSnapshot> {
  // Migrated libraries skip all payload reads. Legacy buffers migrate one at a time.
  if (includeVideos) {
    const [all, references] = await db.transaction('r', db.demoVideos, () =>
      Promise.all([
        db.demoVideos.count(),
        db.demoVideos.where('payloadId').above(Dexie.minKey).count(),
      ]),
    );
    if (all !== references) {
      const legacyIds: string[] = [];
      let idBytes = 0;
      await db.demoVideos.each((video) => {
        if ('data' in video) {
          idBytes += 128 + video.id.length * 2;
          if (idBytes > BACKUP_DIRECTORY_WORKING_BYTES)
            throw new Error(
              'Legacy video migration needs too much memory to process safely',
            );
          legacyIds.push(video.id);
        }
      });
      let current = 0;
      for (const id of legacyIds) {
        signal?.throwIfAborted();
        await resolveVideoReference(id);
        onPreparing?.(++current, legacyIds.length);
      }
    }
  }
  const session = await createBackupSession('export');
  const snapshot: BackupSnapshot = {
    estimatedBytes: 0,
    sessionId: session.id,
    counts: { games: 0, characters: 0, combos: 0, videos: 0 },
  };
  try {
    await db.transaction(
      'rw',
      [
        db.games,
        db.characters,
        db.combos,
        db.settings,
        db.demoVideos,
        db.backupRecords,
        db.backupSessions,
      ],
      async () => {
        let selected:
          | { games: Set<string>; characters: Set<string>; combos: Set<string> }
          | undefined;
        if (filter && Object.values(filter).some((ids) => ids !== undefined)) {
          const games: { id: string }[] = [];
          const characters: { id: string; gameId: string }[] = [];
          const combos: { id: string; characterId: string }[] = [];
          let relationshipBytes = 0;
          const account = (...ids: string[]) => {
            relationshipBytes +=
              128 + ids.reduce((n, id) => n + id.length * 2, 0);
            if (relationshipBytes > BACKUP_DIRECTORY_WORKING_BYTES)
              throw new Error(
                'Backup selection needs too much memory; choose the complete library instead',
              );
          };
          await db.games.each(({ id }) => {
            account(id);
            games.push({ id });
          });
          await db.characters.each(({ id, gameId }) => {
            account(id, gameId);
            characters.push({ id, gameId });
          });
          await db.combos.each(({ id, characterId }) => {
            account(id, characterId);
            combos.push({ id, characterId });
          });
          const closure = closeBackupSelection(
            { games, characters, combos },
            filter,
          );
          selected = {
            games: new Set(closure.games.map((x) => x.id)),
            characters: new Set(closure.characters.map((x) => x.id)),
            combos: new Set(closure.combos.map((x) => x.id)),
          };
        }
        const total =
          (await db.games.count()) +
          (await db.characters.count()) +
          (await db.combos.count());
        let current = 0;
        const settings = await db.settings.get(1);
        snapshot.settings = settings
          ? settingsSchema.parse(settings)
          : undefined;
        for await (const batch of recordBatches(db.games)) {
          signal?.throwIfAborted();
          const records = selected
            ? batch.filter((record) => selected.games.has(record.id))
            : batch;
          await stageBackupRecords(session.id, 'games', records);
          snapshot.counts.games += records.length;
          current += batch.length;
          onPreparing?.(current, total);
        }
        for await (const batch of recordBatches(db.characters)) {
          signal?.throwIfAborted();
          const records = selected
            ? batch.filter((record) => selected.characters.has(record.id))
            : batch;
          await stageBackupRecords(session.id, 'characters', records);
          snapshot.counts.characters += records.length;
          current += batch.length;
          onPreparing?.(current, total);
        }
        for await (const batch of recordBatches(db.combos)) {
          signal?.throwIfAborted();
          const records = selected
            ? batch.filter((record) => selected.combos.has(record.id))
            : batch;
          await stageBackupRecords(session.id, 'combos', records);
          snapshot.counts.combos += records.length;
          if (includeVideos) {
            const candidates = collectLocalVideoIds(records);
            const pinned = await db.backupRecords.bulkGet(
              candidates.map((id) => stagedRecordId(session.id, 'videos', id)),
            );
            const needed = candidates.filter((_id, index) => !pinned[index]);
            const videos = await db.demoVideos.bulkGet(needed);
            const references = videos.flatMap((video) =>
              video && 'payloadId' in video ? [video] : [],
            );
            await stageBackupRecords(session.id, 'videos', references);
            snapshot.counts.videos += references.length;
          }
          current += batch.length;
          onPreparing?.(current, total);
        }
        await db.backupSessions.update(session.id, {
          settings: snapshot.settings,
        });
        await db.backupRecords
          .where('sessionId')
          .equals(session.id)
          .each((row) => {
            snapshot.estimatedBytes += row.bytes + 256;
            if (row.kind === 'videos')
              snapshot.estimatedBytes += row.value.size;
          });
        if (snapshot.settings)
          snapshot.estimatedBytes += new TextEncoder().encode(
            JSON.stringify(snapshot.settings),
          ).byteLength;
      },
    );
    return snapshot;
  } catch (error) {
    await finishBackupSession(session.id);
    throw error;
  }
}
