import {
  DownloadIcon,
  GearSixIcon,
  ListIcon,
  NotebookIcon,
  UploadIcon,
} from '@phosphor-icons/react';
import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MAX_JSON_BACKUP_BYTES } from '@/lib/defaults';
import { reportError, toUserMessage } from '@/lib/errors';
import {
  indexedDbStorage,
  type ZipImportProgress,
} from '@/lib/storage/indexedDbStorage';

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

type ExportSaveResult = 'saved' | 'cancelled' | 'unavailable';

function getExportSuccessMessage(includeVideos: boolean): string {
  return includeVideos ? 'Data exported with demo videos' : 'Data exported';
}

function triggerBlobDownload(blob: Blob, suggestedName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = suggestedName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Do not revoke immediately — large Blob downloads can be truncated.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function saveExportBlob(
  blob: Blob,
  suggestedName: string,
  mimeType: string,
  isDesktop: boolean,
): Promise<ExportSaveResult> {
  if (isDesktop) {
    const buffer = new Uint8Array(await blob.arrayBuffer());
    const result = await window.electronAPI.saveFile(
      buffer,
      suggestedName,
      mimeType,
    );

    if (result.success) {
      return 'saved';
    }

    if (result.error === 'User cancelled') {
      return 'cancelled';
    }

    throw new Error(result.error ?? 'Failed to save exported file');
  }

  if (mimeType === 'application/json') {
    return saveBlobWithPicker(blob, suggestedName, mimeType);
  }

  return 'unavailable';
}

async function saveBlobWithPicker(
  blob: Blob,
  suggestedName: string,
  mimeType: string,
): Promise<'saved' | 'cancelled' | 'unavailable'> {
  const picker = (window as SavePickerWindow).showSaveFilePicker;
  if (!picker) {
    return 'unavailable';
  }

  try {
    const handle = await picker({
      suggestedName,
      types: [
        {
          description: 'Notation Labs Backup',
          accept: {
            [mimeType]: [suggestedName.endsWith('.zip') ? '.zip' : '.json'],
          },
        },
      ],
    });

    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return 'saved';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return 'cancelled';
    }

    // Any other error (SecurityError, file system errors, etc.) falls back to download
    return 'unavailable';
  }
}

export function Header() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [notationGuideOpen, setNotationGuideOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState<{
    current: number;
    total: number | null;
  } | null>(null);
  const [importProgress, setImportProgress] =
    useState<ZipImportProgress | null>(null);
  const [appVersion, setAppVersion] = useState<string>('');
  const isDesktop = !!window.electronAPI;
  const [importOptions, setImportOptions] = useState({
    includeVideos: true,
    includeSettings: false,
  });
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.electronAPI
      ?.getAppVersion()
      .then(setAppVersion)
      .catch((err) => {
        reportError('Header.getAppVersion', err);
      });
  }, []);

  const handleExport = async (
    includeVideos: boolean,
    filter: { gameIds: string[]; characterIds: string[]; comboIds: string[] },
  ) => {
    setExportDialogOpen(false);
    // Show the modal immediately with a spinner so there is no gap before archive building begins.
    if (includeVideos) {
      setExportProgress({ current: 0, total: null });
    }
    try {
      const extension = includeVideos ? 'zip' : 'json';
      const suggestedName = `notation-labs-backup-${Date.now()}.${extension}`;
      const mimeType = includeVideos ? 'application/zip' : 'application/json';
      const successMessage = getExportSuccessMessage(includeVideos);

      const data = await indexedDbStorage.export(
        includeVideos,
        filter,
        includeVideos
          ? (current, total) => setExportProgress({ current, total })
          : undefined,
      );

      const saveResult = await saveExportBlob(
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
      reportError('Header.handleExport', error);
      toast.error('Failed to export data');
    } finally {
      setExportProgress(null);
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
    try {
      if (isZipBackup) {
        setImportProgress({ phase: 'loading', current: 0, total: null });
        await indexedDbStorage.importZip(
          file,
          importOptions.includeVideos,
          importOptions.includeSettings,
          setImportProgress,
        );
      } else {
        const text = await file.text();
        await indexedDbStorage.import(
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
          <NotebookIcon
            className="size-7 sm:size-8 flex-shrink-0"
            weight="duotone"
            style={{ color: 'var(--accent-color, #3b82f6)' }}
          />
          <h1
            className="text-lg sm:text-2xl font-bold tracking-tight truncate"
            style={{ fontFamily: '"JetBrains Mono", "Courier New", monospace' }}
          >
            notation
            <span style={{ color: 'var(--accent-color, #3b82f6)' }}>.LABS</span>
          </h1>
          <span className="text-xs text-muted-foreground font-mono ml-1 self-end mb-0.5 truncate">
            {appVersion ? `v${appVersion}` : ''}
          </span>
        </div>

        {/* Desktop: show inline, Mobile: show hamburger */}
        <div className="hidden sm:flex items-center gap-2 flex-wrap min-w-0">
          <NotationGuide
            open={notationGuideOpen}
            onOpenChange={setNotationGuideOpen}
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
          current={exportProgress.current}
          total={exportProgress.total}
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
