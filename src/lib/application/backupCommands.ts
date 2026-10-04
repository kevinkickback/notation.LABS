import type {
  BackupExportProgress,
  BackupFormat,
  BackupSink,
} from '@/lib/backup/exportContract';
import type { BackupFilter } from '@/lib/backup/selectionClosure';
import { writeBackup } from '@/lib/backup/transferCore';
import {
  canUseTransferWorker,
  runTransferWorker,
} from '@/lib/backup/workerClient';
import { readBackupSelection } from '@/lib/storage/backupSnapshot';
import {
  indexedDbStorage,
  type ZipImportProgress,
} from '@/lib/storage/indexedDbStorage';

export function loadBackupSelectionData() {
  return readBackupSelection();
}

export async function createBackupTo(
  sink: BackupSink,
  format: BackupFormat,
  filter?: BackupFilter,
  onProgress?: (progress: BackupExportProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  try {
    signal?.throwIfAborted();
    const report = (progress: BackupExportProgress) =>
      onProgress?.({
        ...progress,
        warning:
          sink.availableBytes !== undefined &&
          progress.estimatedBytes !== undefined &&
          sink.availableBytes < progress.estimatedBytes
            ? 'The selected drive may not have enough free space for this backup.'
            : progress.warning,
      });
    const progress = canUseTransferWorker()
      ? await runTransferWorker(
          { type: 'start', direction: 'export', format, filter },
          sink.write,
          report,
          undefined,
          signal,
        )
      : await writeBackup(format, sink.write, filter, report, signal);
    signal?.throwIfAborted();
    if (!progress)
      throw new Error('Backup processor returned no export result');
    onProgress?.({ ...progress, phase: 'committing' });
    await sink.close();
  } catch (error) {
    await sink.abort().catch(() => {});
    throw error;
  }
}

export async function importJsonBackup(
  data: string | Blob,
  includeVideos: boolean,
  includeSettings: boolean,
  onProgress?: (progress: ZipImportProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (canUseTransferWorker()) {
    await runTransferWorker(
      {
        type: 'start',
        direction: 'import',
        format: 'json',
        data,
        includeVideos,
        includeSettings,
      },
      undefined,
      undefined,
      onProgress,
      signal,
    );
  } else {
    await indexedDbStorage.import(
      typeof data === 'string' ? data : await data.text(),
      includeVideos,
      includeSettings,
      onProgress,
      signal,
    );
  }
}

export async function importZipBackup(
  file: Blob,
  includeVideos: boolean,
  includeSettings: boolean,
  onProgress?: (progress: ZipImportProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (canUseTransferWorker()) {
    await runTransferWorker(
      {
        type: 'start',
        direction: 'import',
        format: 'zip',
        data: file,
        includeVideos,
        includeSettings,
      },
      undefined,
      undefined,
      onProgress,
      signal,
    );
  } else
    await indexedDbStorage.importZip(
      file,
      includeVideos,
      includeSettings,
      onProgress,
      signal,
    );
}
