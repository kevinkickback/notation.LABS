import { SpinnerGapIcon } from '@phosphor-icons/react';
import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { ZipImportProgress } from '@/lib/storage/zipImport';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChooseFile: (includeVideos: boolean, includeSettings: boolean) => void;
}

interface ImportProgressModalProps extends ZipImportProgress {
  onCancel: () => void;
}

export function ImportProgressModal({
  phase,
  current,
  total,
  bytesProcessed = 0,
  onCancel,
  warning,
}: ImportProgressModalProps) {
  const isVideoPhase = phase === 'videos' && total !== null && total > 0;
  const pct = isVideoPhase ? Math.round((current / total) * 100) : 0;

  return (
    <Dialog open>
      <DialogContent
        className="max-w-xs sm:max-w-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader>
          <DialogTitle>Importing…</DialogTitle>
          <DialogDescription>
            {phase === 'committing'
              ? 'Saving the restored library. Please wait…'
              : phase === 'loading'
                ? 'Reading backup archive…'
                : phase === 'finalizing'
                  ? 'Checking library records…'
                  : `Importing video ${current} of ${total}…`}
          </DialogDescription>
        </DialogHeader>
        {isVideoPhase ? (
          <div className="space-y-2 pt-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-right text-xs text-muted-foreground">{pct}%</p>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
            <SpinnerGapIcon className="size-5 animate-spin" />
            <span>This can take a bit for large backups.</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {(bytesProcessed / 1024 / 1024).toFixed(1)} MB processed
        </p>
        {warning && <p className="text-sm text-muted-foreground">{warning}</p>}
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={phase === 'committing'}
        >
          Cancel import
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function ImportDialog({
  open,
  onOpenChange,
  onChooseFile,
}: ImportDialogProps) {
  const [includeVideos, setIncludeVideos] = useState(true);
  const [includeSettings, setIncludeSettings] = useState(false);
  const includeVideosId = useId();
  const includeSettingsId = useId();

  useEffect(() => {
    if (open) {
      setIncludeVideos(true);
      setIncludeSettings(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[518px]">
        <DialogHeader>
          <DialogTitle>Import Data</DialogTitle>
          <DialogDescription className="sr-only">
            Choose what to include, then select a backup file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor={includeVideosId} className="text-sm">
                Include demo videos
              </Label>
              <p className="text-xs text-muted-foreground">
                Imports local demo files when present in the backup.
              </p>
            </div>
            <Switch
              id={includeVideosId}
              checked={includeVideos}
              onCheckedChange={setIncludeVideos}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor={includeSettingsId} className="text-sm">
                Replace settings
              </Label>
              <p className="text-xs text-muted-foreground">
                Applies settings from the backup and overwrites current
                preferences.
              </p>
            </div>
            <Switch
              id={includeSettingsId}
              checked={includeSettings}
              onCheckedChange={setIncludeSettings}
            />
          </div>

          <Button
            onClick={() => onChooseFile(includeVideos, includeSettings)}
            className="w-full"
          >
            Choose backup file
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
