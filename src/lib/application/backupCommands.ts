import type {
  BackupExportProgress,
  BackupFormat,
  BackupSink,
} from '@/lib/backup/exportContract';
import { writeJsonBackup, writeZipBackup } from '@/lib/backup/exportPipeline';
import type { BackupFilter } from '@/lib/backup/selectionClosure';
import { loadBackupSnapshot } from '@/lib/storage/backupSnapshot';
import {
  indexedDbStorage,
  type ZipImportProgress,
} from '@/lib/storage/indexedDbStorage';

export function loadBackupSelectionData() {
  return Promise.all([
    indexedDbStorage.games.getAll(),
    indexedDbStorage.characters.getAll(),
    indexedDbStorage.combos.getAll(),
    indexedDbStorage.demoVideos.getIds(),
  ]);
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
    const snapshot = await loadBackupSnapshot(filter);
    const progress =
      format === 'zip'
        ? await writeZipBackup(
            snapshot,
            indexedDbStorage.demoVideos.get,
            sink.write,
            onProgress,
            signal,
          )
        : await writeJsonBackup(
            snapshot.records,
            sink.write,
            onProgress,
            signal,
          );
    signal?.throwIfAborted();
    // Once closing starts the file-system commit cannot safely be cancelled.
    onProgress?.({ ...progress, phase: 'committing' });
    await sink.close();
  } catch (error) {
    await sink.abort().catch(() => {
      // Preserve the transfer failure when destination cleanup also fails.
    });
    throw error;
  }
}

export function importJsonBackup(
  data: string,
  includeVideos: boolean,
  includeSettings: boolean,
): Promise<void> {
  return indexedDbStorage.import(data, includeVideos, includeSettings);
}

export function importZipBackup(
  file: Blob,
  includeVideos: boolean,
  includeSettings: boolean,
  onProgress?: (progress: ZipImportProgress) => void,
): Promise<void> {
  return indexedDbStorage.importZip(
    file,
    includeVideos,
    includeSettings,
    onProgress,
  );
}
