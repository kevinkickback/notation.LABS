import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  createBackupTo,
  importJsonBackup,
  importZipBackup,
} from '@/lib/application/backupCommands';
import {
  BACKUP_FORMATS,
  type BackupExportProgress,
  type BackupFormat,
} from '@/lib/backup/exportContract';
import { openBackupSink } from '@/lib/backup/platformSave';
import type { BackupFilter } from '@/lib/backup/selectionClosure';
import { MAX_JSON_BACKUP_BYTES } from '@/lib/defaults';
import { reportError, toUserMessage } from '@/lib/errors';
import type { ZipImportProgress } from '@/lib/storage/indexedDbStorage';

export interface BackupImportOptions {
  includeVideos: boolean;
  includeSettings: boolean;
}

/** Own one transfer from destination choice through commit, including progress and cancellation. */
export function useBackupTransfer() {
  const busy = useRef(false);
  const [isBusy, setIsBusy] = useState(false);
  const [exportProgress, setExportProgress] =
    useState<BackupExportProgress | null>(null);
  const [importProgress, setImportProgress] =
    useState<ZipImportProgress | null>(null);
  const transferController = useRef<AbortController | null>(null);
  const committing = useRef(false);

  useEffect(
    () => () => {
      if (!committing.current) transferController.current?.abort();
    },
    [],
  );

  const exportBackup = async (format: BackupFormat, filter: BackupFilter) => {
    if (busy.current) return;
    busy.current = true;
    setIsBusy(true);
    const controller = new AbortController();
    transferController.current = controller;
    committing.current = false;
    try {
      const name = `notation-labs-backup-${Date.now()}${BACKUP_FORMATS[format].extension}`;
      const sink = await openBackupSink(name, format);
      if (!sink) return;
      setExportProgress({
        phase: 'preparing',
        current: 0,
        total: 0,
        bytesWritten: 0,
      });
      await createBackupTo(
        sink,
        format,
        filter,
        (progress) => {
          committing.current = progress.phase === 'committing';
          setExportProgress(progress);
        },
        controller.signal,
      );
      toast.success(
        format === 'zip' ? 'Data exported with demo videos' : 'Data exported',
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        reportError('backup.export', error);
        toast.error(toUserMessage(error));
      }
    } finally {
      setExportProgress(null);
      transferController.current = null;
      committing.current = false;
      busy.current = false;
      setIsBusy(false);
    }
  };

  const importFile = async (file: File, options: BackupImportOptions) => {
    if (busy.current) return;
    busy.current = true;
    setIsBusy(true);
    const controller = new AbortController();
    transferController.current = controller;
    committing.current = false;
    const progress = (value: ZipImportProgress) => {
      committing.current = value.phase === 'committing';
      setImportProgress(value);
    };
    try {
      const zip =
        file.name.toLowerCase().endsWith('.zip') ||
        file.type === BACKUP_FORMATS.zip.mimeType;
      if (!zip && file.size > MAX_JSON_BACKUP_BYTES)
        throw new Error(
          'This JSON backup is too large to read safely. Choose a ZIP backup.',
        );
      setImportProgress({ phase: 'loading', current: 0, total: null });
      if (zip)
        await importZipBackup(
          file,
          options.includeVideos,
          options.includeSettings,
          progress,
          controller.signal,
        );
      else
        await importJsonBackup(
          file,
          options.includeVideos,
          options.includeSettings,
          progress,
          controller.signal,
        );
      toast.success(
        options.includeSettings
          ? 'Data imported. Settings were replaced from backup.'
          : 'Data imported. Current settings were preserved.',
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        reportError('backup.import', error);
        toast.error(`Failed to import data: ${toUserMessage(error)}`);
      }
    } finally {
      setImportProgress(null);
      transferController.current = null;
      committing.current = false;
      busy.current = false;
      setIsBusy(false);
    }
  };

  return {
    isBusy,
    exportProgress,
    importProgress,
    exportBackup,
    importFile,
    cancelImport: () => {
      if (!committing.current) transferController.current?.abort();
    },
    cancelExport: () => {
      if (!committing.current) transferController.current?.abort();
    },
  };
}
