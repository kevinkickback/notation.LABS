import { ArrowsOutIcon } from '@phosphor-icons/react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/useIsMobile';
import { reportError } from '@/lib/errors';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { cn, getYouTubeEmbedUrl } from '@/lib/utils';

interface VideoPlayerDialogProps {
  open: boolean;
  onClose: () => void;
  videoUrl: string | null;
  title: string;
  videoSize: 'sm' | 'md' | 'lg' | 'xl';
  onVideoSizeChange: (size: 'sm' | 'md' | 'lg' | 'xl') => void;
}

type WebkitFullscreenVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

export function VideoPlayerDialog({
  open,
  onClose,
  videoUrl,
  title,
  videoSize,
  onVideoSizeChange,
}: VideoPlayerDialogProps) {
  const isMobile = useIsMobile();
  const youtubeEmbedUrl = videoUrl ? getYouTubeEmbedUrl(videoUrl) : null;
  const mediaContainerRef = useRef<HTMLDivElement>(null);

  const handleSizeChange = async (size: 'sm' | 'md' | 'lg' | 'xl') => {
    onVideoSizeChange(size);
    try {
      await indexedDbStorage.settings.update({ videoPlayerSize: size });
    } catch (err) {
      reportError('VideoPlayerDialog.handleSizeChange', err);
      toast.error('Failed to save video player size setting');
    }
  };

  const handleFullscreen = () => {
    const el = mediaContainerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen().catch(() => {});
    }
  };

  const handleVideoDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLVideoElement>) => {
      const element = event.currentTarget as WebkitFullscreenVideoElement;
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        element.requestFullscreen().catch(() => {
          element.webkitEnterFullscreen?.();
        });
      }
    },
    [],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className={cn(
          'transition-[max-width] duration-200',
          videoSize === 'sm' && 'sm:max-w-xl',
          videoSize === 'md' && 'sm:max-w-2xl',
          videoSize === 'lg' && 'sm:max-w-4xl',
          videoSize === 'xl' && 'sm:max-w-6xl',
        )}
      >
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <DialogTitle>{title} — Demo</DialogTitle>
            <div className="flex items-center gap-1">
              {isMobile ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={handleFullscreen}
                  title="Fullscreen"
                >
                  <ArrowsOutIcon className="size-4" />
                </Button>
              ) : (
                (['sm', 'md', 'lg', 'xl'] as const).map((size) => (
                  <Button
                    key={size}
                    variant={videoSize === size ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 px-2 text-xs font-mono"
                    onClick={() => handleSizeChange(size)}
                  >
                    {size.toUpperCase()}
                  </Button>
                ))
              )}
            </div>
          </div>
        </DialogHeader>
        {videoUrl &&
          (youtubeEmbedUrl ? (
            <div
              ref={mediaContainerRef}
              className="relative w-full aspect-video"
            >
              <iframe
                src={youtubeEmbedUrl}
                className="absolute inset-0 w-full h-full rounded-lg"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={`${title} — Demo`}
              />
            </div>
          ) : (
            <div ref={mediaContainerRef}>
              <video
                src={videoUrl}
                controls
                autoPlay
                onDoubleClick={handleVideoDoubleClick}
                className="w-full rounded-lg"
                style={{ maxHeight: '80vh' }}
              >
                <track
                  kind="captions"
                  src="data:text/vtt;charset=utf-8,WEBVTT%0A%0A"
                  srcLang="en"
                  label="English"
                  default
                />
              </video>
            </div>
          ))}
      </DialogContent>
    </Dialog>
  );
}
