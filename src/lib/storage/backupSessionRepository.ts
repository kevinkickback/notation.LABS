import Dexie from 'dexie';
import {
  BACKUP_BATCH_BYTES,
  BACKUP_RECORD_BATCH,
  type BackupRecordKind,
  type BackupRecordTypes,
  type BackupSession,
  type StagedBackupRecord,
} from '@/lib/backup/archiveContract';
import { encodeBackupRecord } from '@/lib/backup/capabilities';
import { reportError } from '@/lib/errors';
import { db } from './database';
import { generateId } from './repositoryUtils';

const heartbeats = new Map<string, ReturnType<typeof setInterval>>();

export const stagedRecordId = (
  sessionId: string,
  kind: BackupRecordKind,
  entityId: string,
) => `${sessionId}/${kind}/${entityId}`;

export async function createBackupSession(
  kind: BackupSession['kind'],
): Promise<BackupSession> {
  const session: BackupSession = {
    id: generateId(),
    kind,
    state: 'staging',
    updatedAt: Date.now(),
  };
  await db.backupSessions.add(session);
  heartbeats.set(
    session.id,
    setInterval(() => {
      void db.backupSessions
        .update(session.id, { updatedAt: Date.now() })
        .catch((error: unknown) => reportError('backup.heartbeat', error));
    }, 30_000),
  );
  return session;
}

function backupRecord<K extends BackupRecordKind>(
  sessionId: string,
  kind: K,
  value: BackupRecordTypes[K],
  asset?: StagedBackupRecord['asset'],
): StagedBackupRecord {
  const row = {
    id: stagedRecordId(sessionId, kind, value.id),
    sessionId,
    kind,
    entityId: value.id,
    value,
    bytes: encodeBackupRecord(value).byteLength,
    asset,
    payloadId:
      kind === 'videos'
        ? (value as BackupRecordTypes['videos']).payloadId
        : undefined,
  } as StagedBackupRecord;
  return row;
}

export function stageBackupRecord<K extends BackupRecordKind>(
  sessionId: string,
  kind: K,
  value: BackupRecordTypes[K],
  asset?: StagedBackupRecord['asset'],
): Promise<string> {
  return db.backupRecords.add(backupRecord(sessionId, kind, value, asset));
}

export async function stageBackupRecords<K extends BackupRecordKind>(
  sessionId: string,
  kind: K,
  values: BackupRecordTypes[K][],
): Promise<void> {
  await db.backupRecords.bulkAdd(
    values.map((value) => backupRecord(sessionId, kind, value)),
  );
}

/** One bounded staging batch; decoding and relationship checks remain in the codec. */
export function createBackupRecordStager<K extends BackupRecordKind>(
  sessionId: string,
  kind: K,
) {
  let rows: StagedBackupRecord[] = [];
  let bytes = 0;
  const flush = async () => {
    if (!rows.length) return;
    await db.backupRecords.bulkAdd(rows);
    rows = [];
    bytes = 0;
  };
  return {
    flush,
    async add(
      value: BackupRecordTypes[K],
      asset?: StagedBackupRecord['asset'],
    ) {
      const row = backupRecord(sessionId, kind, value, asset);
      if (rows.length && bytes + row.bytes > BACKUP_BATCH_BYTES) await flush();
      rows.push(row);
      bytes += row.bytes;
      if (rows.length >= BACKUP_RECORD_BATCH || bytes >= BACKUP_BATCH_BYTES)
        await flush();
    },
  };
}

export async function readStagedRecord<K extends BackupRecordKind>(
  sessionId: string,
  kind: K,
  entityId: string,
): Promise<BackupRecordTypes[K] | undefined> {
  const row = await db.backupRecords.get(
    stagedRecordId(sessionId, kind, entityId),
  );
  // This checked discriminator matches the generic repository key.
  return row?.kind === kind ? (row.value as BackupRecordTypes[K]) : undefined;
}

export async function* stagedRowsBatches(
  sessionId: string,
  kind: BackupRecordKind,
): AsyncGenerator<StagedBackupRecord[], void> {
  let after: string | typeof Dexie.minKey = Dexie.minKey;
  for (;;) {
    let bytes = 0;
    let count = 0;
    const rows: StagedBackupRecord[] = await db.backupRecords
      .where('[sessionId+kind+entityId]')
      .between(
        [sessionId, kind, after],
        [sessionId, kind, Dexie.maxKey],
        false,
        true,
      )
      .limit(BACKUP_RECORD_BATCH)
      .until((row) => {
        if (count && bytes + row.bytes > BACKUP_BATCH_BYTES) return true;
        bytes += row.bytes;
        count++;
        return false;
      })
      .toArray();
    if (!rows.length) return;
    yield rows;
    after = rows[rows.length - 1].entityId;
  }
}

export async function* stagedRecordBatches<K extends BackupRecordKind>(
  sessionId: string,
  kind: K,
): AsyncGenerator<BackupRecordTypes[K][], void> {
  for await (const rows of stagedRowsBatches(sessionId, kind))
    yield rows.map((row) => row.value as BackupRecordTypes[K]);
}

/** Must share the transaction that removes a library reference or snapshot pin. */
export async function collectUnusedPayloads(
  payloadIds: string[],
): Promise<void> {
  const ids = [...new Set(payloadIds)];
  if (ids.length > 1) {
    const referenced = new Set<string>();
    await db.demoVideos
      .where('payloadId')
      .anyOf(ids)
      .each((video) => {
        if ('payloadId' in video) referenced.add(video.payloadId);
      });
    await db.backupRecords
      .where('payloadId')
      .anyOf(ids)
      .each((row) => {
        if (row.payloadId) referenced.add(row.payloadId);
      });
    await db.mediaPayloads.bulkDelete(ids.filter((id) => !referenced.has(id)));
    return;
  }
  for (const id of ids) {
    if (await db.demoVideos.where('payloadId').equals(id).count()) continue;
    if (await db.backupRecords.where('payloadId').equals(id).count()) continue;
    await db.mediaPayloads.delete(id);
  }
}

export async function cleanupBackupSession(id: string): Promise<void> {
  clearInterval(heartbeats.get(id));
  heartbeats.delete(id);
  await db.transaction(
    'rw',
    [db.backupSessions, db.backupRecords, db.mediaPayloads, db.demoVideos],
    async () => {
      for await (const batch of stagedRecordBatches(id, 'videos')) {
        await db.backupRecords.bulkDelete(
          batch.map((value) => stagedRecordId(id, 'videos', value.id)),
        );
        await collectUnusedPayloads(batch.map((value) => value.payloadId));
      }
      await db.backupRecords.where('sessionId').equals(id).delete();
      // A failed extraction can leave a payload before its metadata record was staged.
      let after = '';
      for (;;) {
        const payloads = await db.mediaPayloads
          .where('[sessionId+id]')
          .between([id, after], [id, Dexie.maxKey], false, true)
          .limit(BACKUP_RECORD_BATCH)
          .toArray();
        if (!payloads.length) break;
        await collectUnusedPayloads(payloads.map((payload) => payload.id));
        after = payloads[payloads.length - 1].id;
      }
      await db.backupSessions.delete(id);
    },
  );
}

/** The cross-context transfer lock prevents recovery from deleting another live job. */
export async function withBackupSessionLock<T>(
  run: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return await navigator.locks.request(
      'notation-labs-backup',
      { signal },
      async () => {
        signal?.throwIfAborted();
        await recoverBackupSessions(true);
        return run();
      },
    );
  }
  await recoverBackupSessions();
  signal?.throwIfAborted();
  return run();
}

/** Startup must not wait for or clean up a transfer running in another context. */
export async function recoverIdleBackupSessions(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    await navigator.locks.request(
      'notation-labs-backup',
      { ifAvailable: true },
      async (lock) => {
        if (lock) await recoverBackupSessions(true);
      },
    );
  } else await recoverBackupSessions();
}

/** A cleanup failure cannot turn a committed import into a reported import failure. */
export async function finishBackupSession(id: string): Promise<void> {
  try {
    await cleanupBackupSession(id);
  } catch (error) {
    reportError('backup.cleanup', error);
  }
}

export async function recoverBackupSessions(all = false): Promise<void> {
  const sessions = await db.backupSessions.toArray();
  for (const session of sessions) {
    // Without Web Locks, retain recent jobs that may belong to another browser tab.
    if (all || Date.now() - session.updatedAt > 24 * 60 * 60 * 1000)
      await cleanupBackupSession(session.id);
  }
}
