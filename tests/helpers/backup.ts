import { createBackupTo } from '@/lib/application/backupCommands';
import { BACKUP_FORMATS, type BackupExportProgress } from '@/lib/backup/exportContract';
import type { BackupFilter } from '@/lib/backup/selectionClosure';

/** Small test fixtures capture the public streaming command, without a buffered app API. */
export async function captureBackup(includeVideos = false, filter?: BackupFilter, onProgress?: (progress: BackupExportProgress) => void): Promise<Blob> {
  const parts: Blob[] = [];
  const format = includeVideos ? 'zip' : 'json';
  await createBackupTo({ write: async chunk => { parts.push(new Blob([new Uint8Array(chunk)])); }, close: async () => undefined, abort: async () => { parts.length = 0; } }, format, filter, onProgress);
  return new Blob(parts, { type: BACKUP_FORMATS[format].mimeType });
}
