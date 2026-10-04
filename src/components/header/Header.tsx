import {
  DownloadIcon,
  GearSixIcon,
  ListIcon,
  NotebookIcon,
  UploadIcon,
} from '@phosphor-icons/react';
import type { ChangeEvent } from 'react';
import { useRef, useState } from 'react';
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
import { useBackupTransfer } from '@/hooks/useBackupTransfer';
import type { BackupFilter } from '@/lib/backup/selectionClosure';
import type { Game } from '@/lib/types';

export function Header({ activeGame }: { activeGame?: Game }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [notationGuideOpen, setNotationGuideOpen] = useState(false);
  const {
    isBusy,
    exportProgress,
    importProgress,
    exportBackup,
    importFile,
    cancelExport,
    cancelImport,
  } = useBackupTransfer();
  const [importOptions, setImportOptions] = useState({
    includeVideos: true,
    includeSettings: false,
  });
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleExport = (includeVideos: boolean, filter: BackupFilter) => {
    setExportDialogOpen(false);
    return exportBackup(includeVideos ? 'zip' : 'json', filter);
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
  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    await importFile(file, importOptions);
    setImportOptions({ includeVideos: true, includeSettings: false });
    input.value = '';
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
            disabled={isBusy}
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
            disabled={isBusy}
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
                  disabled={isBusy}
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
                  disabled={isBusy}
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
        <ExportProgressModal {...exportProgress} onCancel={cancelExport} />
      )}
      {importProgress && (
        <ImportProgressModal
          phase={importProgress.phase}
          current={importProgress.current}
          total={importProgress.total}
          bytesProcessed={importProgress.bytesProcessed}
          warning={importProgress.warning}
          onCancel={cancelImport}
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
