import Dexie, { type EntityTable } from 'dexie';
import {
  BACKUP_BATCH_BYTES,
  BACKUP_RECORD_BATCH,
} from '@/lib/backup/archiveContract';
import {
  BACKUP_DIRECTORY_WORKING_BYTES,
  encodeBackupRecord,
} from '@/lib/backup/capabilities';

/** Read a bounded index for presentation without retaining notes, covers, tokens, or media. */
export async function projectRecords<T extends { id: string }, R>(
  table: EntityTable<T, 'id'>,
  project: (record: T) => R,
): Promise<R[]> {
  const values: R[] = [];
  let bytes = 0;
  await table.each((record) => {
    const value = project(record);
    bytes += 128 + encodeBackupRecord(value).byteLength * 2;
    if (bytes > BACKUP_DIRECTORY_WORKING_BYTES)
      throw new Error('Library index needs too much memory to read safely');
    values.push(value);
  });
  return values;
}

/** Keyset pagination works inside the caller's transaction, without retaining a collection. */
export async function* recordBatches<T extends { id: string }>(
  table: EntityTable<T, 'id'>,
  scope?: { index: string; value: string },
): AsyncGenerator<T[], void> {
  let after: string | undefined;
  for (;;) {
    let bytes = 0;
    let count = 0;
    const collection = scope
      ? table
          .where(`[${scope.index}+id]`)
          .between(
            [scope.value, after ?? Dexie.minKey],
            [scope.value, Dexie.maxKey],
            false,
            true,
          )
      : after === undefined
        ? table.orderBy('id')
        : table.where('id').above(after);
    const batch: T[] = await collection
      .limit(BACKUP_RECORD_BATCH)
      .until((record) => {
        const size = encodeBackupRecord(record).byteLength;
        if (count && bytes + size > BACKUP_BATCH_BYTES) return true;
        count++;
        bytes += size;
        return false;
      })
      .toArray();
    if (!batch.length) return;
    yield batch;
    after = batch[batch.length - 1].id;
  }
}
