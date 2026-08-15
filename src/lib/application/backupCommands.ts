import type { BackupFilter } from '@/lib/backup/selectionClosure';
import {
  indexedDbStorage,
  type ZipImportProgress,
} from '@/lib/storage/indexedDbStorage';

export function loadBackupSelectionData() {
  return Promise.all([
    indexedDbStorage.games.getAll(),
    indexedDbStorage.characters.getAll(),
    indexedDbStorage.combos.getAll(),
    indexedDbStorage.demoVideos.getAll(),
  ]);
}

export function createBackup(
  includeVideos: boolean,
  filter: BackupFilter,
  onProgress?: (current: number, total: number) => void,
): Promise<Blob> {
  return indexedDbStorage.export(includeVideos, filter, onProgress);
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
