import { MAX_JSON_BACKUP_BYTES } from '@/lib/defaults';

// Allocation budgets, not limits on the total library or media bytes. Legacy JSON
// and unusually large single records share the existing whole-document budget.
export const BACKUP_RECORD_BYTES = MAX_JSON_BACKUP_BYTES;
export const BACKUP_MANIFEST_BYTES = MAX_JSON_BACKUP_BYTES;
export const BACKUP_DIRECTORY_BYTES = 64 * 1024 * 1024;
export const BACKUP_DIRECTORY_WORKING_BYTES = 256 * 1024 * 1024;

export function assertSafeSize(size: number): void {
  if (!Number.isSafeInteger(size) || size < 0)
    throw new Error('Backup contains an unsupported file size or offset');
}

/** Accounts for both encoded headers and the reader/writer's per-entry objects. */
export class BackupDirectoryBudget {
  private encoded = 0;
  private working = 0;
  add(path: string, extraBytes = 0): void {
    const nameBytes = new TextEncoder().encode(path).byteLength;
    // Our writer uses fixed short names and ZIP64 headers. Import additionally
    // accounts for actual comments/extra fields supplied by other ZIP writers.
    this.encoded += 128 + nameBytes + extraBytes;
    this.working += 2048 + path.length * 2 + extraBytes;
    if (
      this.encoded > BACKUP_DIRECTORY_BYTES ||
      this.working > BACKUP_DIRECTORY_WORKING_BYTES
    )
      throw new Error(
        'Backup file directory needs too much memory to process safely',
      );
  }
}

export function encodeBackupRecord(value: unknown): Uint8Array<ArrayBuffer> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  if (bytes.byteLength > BACKUP_RECORD_BYTES)
    throw new Error('A library record is too large to process safely');
  return bytes;
}
