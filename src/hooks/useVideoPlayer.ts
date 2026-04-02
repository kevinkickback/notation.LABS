import { useCallback, useState } from 'react';
import type { Combo } from '@/lib/types';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
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
		if (combo.demoUrl.startsWith('local:')) {
			const videoId = combo.demoUrl.replace('local:', '');
			const blobUrl = await indexedDbStorage.demoVideos.getBlobUrl(videoId);
			if (blobUrl) {
				setVideoPlayerUrl(blobUrl);
				setVideoPlayerTitle(combo.name);
				setVideoPlayerOpen(true);
			} else {
				toast.error('Video file not found');
			}
		} else {
			setVideoPlayerUrl(combo.demoUrl);
			setVideoPlayerTitle(combo.name);
			setVideoPlayerOpen(true);
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
