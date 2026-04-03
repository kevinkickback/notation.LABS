import { useCallback, useState, useEffect } from 'react';
import type { Combo } from '@/lib/types';
import {
  getLocalVideoId,
  indexedDbStorage,
} from '@/lib/storage/indexedDbStorage';
import { reportError, toUserMessage } from '@/lib/errors';
import { toast } from 'sonner';

/**
 * Manages video player dialog state and operations
 */
export function useVideoPlayer(videoPlayerSize: 'sm' | 'md' | 'lg' | 'xl') {
  const [videoPlayerOpen, setVideoPlayerOpen] = useState(false);
  const [videoPlayerUrl, setVideoPlayerUrl] = useState<string | null>(null);
  const [videoPlayerTitle, setVideoPlayerTitle] = useState('');
  const [videoSize, setVideoSize] = useState<'sm' | 'md' | 'lg' | 'xl'>(
    videoPlayerSize,
  );

  const handleWatchDemo = useCallback(async (combo: Combo) => {
    if (!combo.demoUrl) return;
    try {
      const localVideoId = getLocalVideoId(combo.demoUrl);
      if (localVideoId) {
        const blobUrl =
          await indexedDbStorage.demoVideos.getBlobUrl(localVideoId);
        if (!blobUrl) {
          toast.error('Video file not found');
          return;
        }

        setVideoPlayerUrl(blobUrl);
        setVideoPlayerTitle(combo.name);
        setVideoPlayerOpen(true);
        return;
      }

      setVideoPlayerUrl(combo.demoUrl);
      setVideoPlayerTitle(combo.name);
      setVideoPlayerOpen(true);
    } catch (err) {
      reportError('useVideoPlayer.handleWatchDemo', err);
      toast.error(toUserMessage(err));
    }
  }, []);

  const closeVideoPlayer = useCallback(() => {
    setVideoPlayerOpen(false);
    if (videoPlayerUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(videoPlayerUrl);
    }
    setVideoPlayerUrl(null);
    setVideoPlayerTitle('');
  }, [videoPlayerUrl]);

  useEffect(() => {
    return () => {
      if (videoPlayerUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(videoPlayerUrl);
      }
    };
  }, [videoPlayerUrl]);

  return {
    videoPlayerOpen,
    videoPlayerUrl,
    videoPlayerTitle,
    videoSize,
    setVideoSize,
    handleWatchDemo,
    closeVideoPlayer,
  };
}
