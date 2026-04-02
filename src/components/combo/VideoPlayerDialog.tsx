import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCallback, useRef } from 'react';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { ArrowsOut } from '@phosphor-icons/react';
import { useIsMobile } from '@/hooks/useIsMobile';

function getYouTubeEmbedUrl(url: string): string | null {
	try {
		const u = new URL(url);
		let videoId: string | null = null;
		if (u.hostname.includes('youtube.com')) videoId = u.searchParams.get('v');
		else if (u.hostname.includes('youtu.be')) videoId = u.pathname.slice(1).split('/')[0];
		if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
	} catch { /* not a valid URL */ }
	return null;
}

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

	const handleSizeChange = (size: 'sm' | 'md' | 'lg' | 'xl') => {
		onVideoSizeChange(size);
		indexedDbStorage.settings.update({ videoPlayerSize: size });
	};

	const handleFullscreen = () => {
		const el = mediaContainerRef.current;
		if (!el) return;
		if (document.fullscreenElement) {
			document.exitFullscreen();
		} else {
			el.requestFullscreen().catch(() => { });
		}
	};

	const videoRef = useCallback((el: HTMLVideoElement | null) => {
		if (!el) return;
		el.addEventListener('dblclick', () => {
			if (document.fullscreenElement) {
				document.exitFullscreen();
			} else {
				el.requestFullscreen().catch(() => {
					(el as WebkitFullscreenVideoElement).webkitEnterFullscreen?.();
				});
			}
		});
	}, []);

	return (
		<Dialog
			open={open}
			onOpenChange={(isOpen) => {
				if (!isOpen) onClose();
			}}
		>
			<DialogContent
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
									<ArrowsOut className="size-4" />
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
				{videoUrl && (
					youtubeEmbedUrl ? (
						<div ref={mediaContainerRef} className="relative w-full aspect-video">
							<iframe
								src={youtubeEmbedUrl}
								className="absolute inset-0 w-full h-full rounded-lg"
								allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
								allowFullScreen
								title={`${title} — Demo`}
							/>
						</div>
					) : (
						<div ref={mediaContainerRef}>
							<video
								ref={videoRef}
								src={videoUrl}
								controls
								autoPlay
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
					)
				)}
			</DialogContent>
		</Dialog>
	);
}
