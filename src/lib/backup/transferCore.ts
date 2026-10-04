import {
  finishBackupSession,
  withBackupSessionLock,
} from '@/lib/storage/backupSessionRepository';
import { loadBackupSnapshot } from '@/lib/storage/backupSnapshot';
import { storageWarning } from './capacity';
import type {
  BackupExportProgress,
  BackupFormat,
  BackupSink,
} from './exportContract';
import { writeJsonBackup, writeZipBackup } from './exportPipeline';
import type { BackupFilter } from './selectionClosure';

/** Storage and codecs can run in a worker. The caller retains ownership of destination commit. */
export function writeBackup(
  format: BackupFormat,
  write: BackupSink['write'],
  filter?: BackupFilter,
  onProgress?: (progress: BackupExportProgress) => void,
  signal?: AbortSignal,
): Promise<BackupExportProgress> {
  return withBackupSessionLock(async () => {
    signal?.throwIfAborted();
    const warning = await storageWarning();
    onProgress?.({
      phase: 'preparing',
      current: 0,
      total: 0,
      bytesWritten: 0,
      warning,
    });
    const snapshot = await loadBackupSnapshot(
      filter,
      signal,
      format === 'zip',
      (current, total) =>
        onProgress?.({
          phase: 'preparing',
          current,
          total,
          bytesWritten: 0,
          warning,
        }),
    );
    try {
      const report = (progress: BackupExportProgress) =>
        onProgress?.({
          ...progress,
          estimatedBytes: snapshot.estimatedBytes,
          warning,
        });
      return format === 'zip'
        ? await writeZipBackup(snapshot, write, report, signal)
        : await writeJsonBackup(snapshot, write, report, signal);
    } finally {
      await finishBackupSession(snapshot.sessionId);
    }
  }, signal);
}
