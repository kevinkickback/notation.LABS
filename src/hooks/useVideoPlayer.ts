import { useCallback, useEffect, useState } from 'react';
import { useMediaRequest } from '@/hooks/useMediaRequest';
import { reportError, toUserMessage } from '@/lib/errors';
import { notify } from '@/lib/notifications';
import { externalHttpsUrlSchema } from '@/lib/schemas';
import {
  getLocalVideoId,
  indexedDbStorage,
} from '@/lib/storage/indexedDbStorage';
import type { Combo } from '@/lib/types';

interface PlayerMedia {
  url: string;
  title: string;
}

function releaseMedia(media: PlayerMedia | null) {
  if (media?.url.startsWith('blob:')) URL.revokeObjectURL(media.url);
}

export function useVideoPlayer(
  videoPlayerSize: 'sm' | 'md' | 'lg' | 'xl',
  sessionKey = '',
) {
  const [media, setMedia] = useState<PlayerMedia | null>(null);
  const [videoSize, setVideoSize] = useState(videoPlayerSize);
  const { run, cancel } = useMediaRequest(true, sessionKey);

  const handleWatchDemo = useCallback(
    async (combo: Combo) => {
      const url = combo.demoUrl;
      if (!url) return;
      await run(
        combo.id,
        async () => {
          const localId = getLocalVideoId(url);
          if (localId) {
            const blobUrl =
              await indexedDbStorage.demoVideos.getBlobUrl(localId);
            return blobUrl ? { url: blobUrl, title: combo.name } : null;
          }
          if (!externalHttpsUrlSchema.safeParse(url).success)
            throw new Error('Demo URL must use HTTPS without credentials');
          return { url, title: combo.name };
        },
        {
          onSuccess: (next) => {
            if (next) setMedia(next);
            else notify.error('Video file not found');
          },
          onDiscard: releaseMedia,
          onError: (error) => {
            reportError('useVideoPlayer.handleWatchDemo', error);
            notify.error(toUserMessage(error));
          },
        },
      );
    },
    [run],
  );

  const closeVideoPlayer = useCallback(() => {
    cancel();
    setMedia(null);
  }, [cancel]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Navigating to a different character closes its player.
  useEffect(() => {
    setMedia(null);
  }, [sessionKey]);

  useEffect(() => () => releaseMedia(media), [media]);

  return {
    videoPlayerOpen: media !== null,
    videoPlayerUrl: media?.url ?? null,
    videoPlayerTitle: media?.title ?? '',
    videoSize,
    setVideoSize,
    handleWatchDemo,
    closeVideoPlayer,
  };
}
