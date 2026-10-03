import {
  DownloadIcon,
  GearSixIcon,
  ListIcon,
  NotebookIcon,
  UploadIcon,
} from '@phosphor-icons/react';
import type { ChangeEvent } from 'react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ExportDialog,
  ExportProgressModal,
} from '@/components/header/ExportDialog';
import {
  ImportDialog,
  ImportProgressModal,
} from '@/components/header/ImportDialog';
import { NotationGuide } from '@/components/header/NotationGuide';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { AppLogo } from '@/components/shared/AppLogo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  createBackup,
  createBackupTo,
  importJsonBackup,
  importZipBackup,
} from '@/lib/application/backupCommands';
import type { BackupExportProgress } from '@/lib/backup/exportContract';
import {
  openBackupSink,
  saveBackupBlob,
  triggerBlobDownload,
} from '@/lib/backup/platformSave';
import { MAX_JSON_BACKUP_BYTES, MAX_ZIP_BACKUP_BYTES } from '@/lib/defaults';
import { reportError, toUserMessage } from '@/lib/errors';
import type { ZipImportProgress } from '@/lib/storage/indexedDbStorage';
import type { Game } from '@/lib/types';

function getExportSuccessMessage(includeVideos: boolean): string {
  return includeVideos ? 'Data exported with demo videos' : 'Data exported';
}

export function Header({ activeGame }: { activeGame?: Game }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [notationGuideOpen, setNotationGuideOpen] = useState(false);
  const [exportProgress, setExportProgress] =
    useState<BackupExportProgress | null>(null);
  const exportController = useRef<AbortController | null>(null);
  const exportCommitting = useRef(false);
  const [importProgress, setImportProgress] =
    useState<ZipImportProgress | null>(null);
  const isDesktop = !!window.electronAPI;
  const [importOptions, setImportOptions] = useState({
    includeVideos: true,
    includeSettings: false,
  });
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async (
    includeVideos: boolean,
    filter: { gameIds: string[]; characterIds: string[]; comboIds: string[] },
  ) => {
    setExportDialogOpen(false);
    try {
      const extension = includeVideos ? 'zip' : 'json';
      const suggestedName = `notation-labs-backup-${Date.now()}.${extension}`;
      const mimeType = includeVideos ? 'application/zip' : 'application/json';
      const successMessage = getExportSuccessMessage(includeVideos);

      if (includeVideos) {
        const sink = await openBackupSink(suggestedName);
        if (!sink) return;
        const controller = new AbortController();
        exportController.current = controller;
        exportCommitting.current = false;
        setExportProgress({
          phase: 'videos',
          current: 0,
          total: 0,
          bytesWritten: 0,
        });
        await createBackupTo(
          sink,
          filter,
          (progress) => {
            exportCommitting.current = progress.phase === 'committing';
            setExportProgress(progress);
          },
          controller.signal,
        );
        toast.success(successMessage);
        return;
      }

      const data = await createBackup(includeVideos, filter, undefined);

      const saveResult = await saveBackupBlob(
        data,
        suggestedName,
        mimeType,
        isDesktop,
      );
      if (saveResult === 'saved') {
        toast.success(successMessage);
        return;
      }
      if (saveResult === 'cancelled') {
        return;
      }

      triggerBlobDownload(data, suggestedName);
      toast.success(successMessage);
    } catch (error) {
      if (exportController.current?.signal.aborted) return;
      reportError('Header.handleExport', error);
      toast.error(toUserMessage(error));
    } finally {
      setExportProgress(null);
      exportController.current = null;
      exportCommitting.current = false;
    }
  };

  const handleImportClick = () => setImportDialogOpen(true);

  const handleChooseImportFile = (
    includeVideos: boolean,
    includeSettings: boolean,
  ) => {
    setImportOptions({ includeVideos, includeSettings });
    setImportDialogOpen(false);
    importInputRef.current?.click();
  };

  const handleImportChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isZipBackup =
      file.name.toLowerCase().endsWith('.zip') ||
      file.type === 'application/zip';

    if (!isZipBackup && file.size > MAX_JSON_BACKUP_BYTES) {
      toast.error(
        'Backup file is too large for JSON import. Export fewer videos or use filters.',
      );
      e.target.value = '';
      return;
    }
    if (isZipBackup && file.size > MAX_ZIP_BACKUP_BYTES) {
      toast.error('Backup zip exceeds the 512 MB import limit.');
      e.target.value = '';
      return;
    }
    try {
      if (isZipBackup) {
        setImportProgress({ phase: 'loading', current: 0, total: null });
        await importZipBackup(
          file,
          importOptions.includeVideos,
          importOptions.includeSettings,
          setImportProgress,
        );
      } else {
        const text = await file.text();
        await importJsonBackup(
          text,
          importOptions.includeVideos,
          importOptions.includeSettings,
        );
      }
      toast.success(
        importOptions.includeSettings
          ? 'Data imported. Settings were replaced from backup.'
          : 'Data imported. Current settings were preserved.',
      );
    } catch (err) {
      toast.error(`Failed to import data: ${toUserMessage(err)}`);
    } finally {
      setImportProgress(null);
    }
    setImportOptions({ includeVideos: true, includeSettings: false });
    e.target.value = '';
  };

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50 w-full">
      <div className="container mx-auto px-2 py-3 flex flex-wrap items-center justify-between min-w-0 w-full gap-y-2">
        <div className="flex items-center gap-2 min-w-0 flex-shrink-1">
          <AppLogo className="size-10 object-contain flex-shrink-0" />
          <h1
            className="text-lg sm:text-2xl font-bold tracking-tight truncate"
            style={{ fontFamily: '"JetBrains Mono", "Courier New", monospace' }}
          >
            notation
            <span style={{ color: 'var(--accent-color, #3b82f6)' }}>.LABS</span>
          </h1>
        </div>

        {/* Desktop: show inline, Mobile: show hamburger */}
        <div className="hidden sm:flex items-center gap-2 flex-wrap min-w-0">
          <NotationGuide
            open={notationGuideOpen}
            onOpenChange={setNotationGuideOpen}
            activeGame={activeGame}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExportDialogOpen(true)}
            title="Export Data"
            aria-label="Export data"
            className="flex-shrink-0"
          >
            <UploadIcon className="size-5 sm:size-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleImportClick}
            title="Import Data"
            aria-label="Import data"
            className="flex-shrink-0"
          >
            <DownloadIcon className="size-5 sm:size-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="flex-shrink-0"
          >
            <GearSixIcon className="size-5 sm:size-6" />
          </Button>
        </div>

        {/* Mobile: Hamburger menu */}
        <div className="flex sm:hidden items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <ListIcon className="size-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="z-50 min-w-[10rem] rounded-md border bg-popover p-2 shadow-md"
            >
              <DropdownMenuItem asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full justify-start"
                  onClick={() => setNotationGuideOpen(true)}
                >
                  <NotebookIcon className="size-5" />
                  <span className="ml-2">Notation Guide</span>
                </Button>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setExportDialogOpen(true)}
                  className="w-full justify-start"
                >
                  <UploadIcon className="size-5" />
                  <span className="ml-2">Export Data</span>
                </Button>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleImportClick}
                  className="w-full justify-start"
                >
                  <DownloadIcon className="size-5" />
                  <span className="ml-2">Import Data</span>
                </Button>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSettingsOpen(true)}
                  className="w-full justify-start"
                >
                  <GearSixIcon className="size-5" />
                  <span className="ml-2">Settings</span>
                </Button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={handleExport}
      />
      {exportProgress && (
        <ExportProgressModal
          {...exportProgress}
          onCancel={() => {
            if (!exportCommitting.current) exportController.current?.abort();
          }}
        />
      )}
      {importProgress && (
        <ImportProgressModal
          phase={importProgress.phase}
          current={importProgress.current}
          total={importProgress.total}
        />
      )}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onChooseFile={handleChooseImportFile}
      />
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json,application/zip,.zip"
        className="hidden"
        onChange={handleImportChange}
      />
    </header>
  );
}
