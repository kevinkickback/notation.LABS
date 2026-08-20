import { SpinnerGapIcon, XIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUpdater } from '@/context/UpdaterContext';

interface UpdateProgressModalProps {
  open: boolean;
  version: string;
  onOpenChange: (open: boolean) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
}

type UpdatePhase = 'downloading' | 'downloaded' | 'error' | 'cancelled';

export function UpdateProgressModal({
  open,
  version,
  onOpenChange,
}: UpdateProgressModalProps) {
  const { status, cancelUpdate, downloadUpdate, installUpdate } = useUpdater();
  const [restartCountdown, setRestartCountdown] = useState<number | null>(null);
  const phase: UpdatePhase =
    status.status === 'downloaded' ||
    status.status === 'error' ||
    status.status === 'cancelled'
      ? status.status
      : 'downloading';
  const percentage = status.progress?.percentage ?? 0;
  const bytesPerSecond = status.progress?.bytesPerSecond ?? 0;
  const total = status.progress?.total ?? 0;
  const transferred = status.progress?.transferred ?? 0;

  useEffect(() => {
    if (!open) {
      setRestartCountdown(null);
      return;
    }
    if (status.status === 'downloaded') setRestartCountdown(3);
  }, [open, status.status]);

  // Restart countdown
  useEffect(() => {
    if (restartCountdown === null || restartCountdown <= 0) return;

    const timer = setTimeout(() => {
      setRestartCountdown(restartCountdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [restartCountdown]);

  // Auto-install when countdown reaches 0
  useEffect(() => {
    if (restartCountdown === 0) void installUpdate();
  }, [installUpdate, restartCountdown]);

  const handleCancel = useCallback(() => {
    void cancelUpdate();
  }, [cancelUpdate]);

  const handleRetry = useCallback(() => {
    void downloadUpdate();
  }, [downloadUpdate]);

  const handleDismiss = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full max-w-xs sm:max-w-sm p-3 sm:p-6"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {phase === 'downloading' && `Downloading v${version}...`}
            {phase === 'downloaded' && 'Update Ready'}
            {phase === 'error' && 'Update Failed'}
            {phase === 'cancelled' && 'Download Cancelled'}
          </DialogTitle>
          <DialogDescription>
            {phase === 'downloading' &&
              'Please wait while the update is being downloaded.'}
            {phase === 'downloaded' && `Restarting in ${restartCountdown}s...`}
            {phase === 'error' &&
              (status.error ?? 'An error occurred during download.')}
            {phase === 'cancelled' && 'The download was cancelled.'}
          </DialogDescription>
        </DialogHeader>

        {phase === 'downloading' && (
          <div className="space-y-3">
            {/* Progress bar */}
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{percentage.toFixed(0)}%</span>
              <span>
                {formatBytes(transferred)} / {formatBytes(total)}
              </span>
              <span>{formatBytes(bytesPerSecond)}/s</span>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <XIcon size={14} className="mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {phase === 'downloaded' && (
          <div className="flex items-center justify-center py-4">
            <SpinnerGapIcon size={24} className="animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">
              Installing update...
            </span>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              Dismiss
            </Button>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              Retry
            </Button>
          </div>
        )}

        {phase === 'cancelled' && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleDismiss}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
