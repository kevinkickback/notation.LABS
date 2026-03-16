import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCallback } from 'react';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';

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
	const handleSizeChange = (size: 'sm' | 'md' | 'lg' | 'xl') => {
		onVideoSizeChange(size);
		indexedDbStorage.settings.update({ videoPlayerSize: size });
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
							{(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
								<Button
									key={size}
									variant={videoSize === size ? 'secondary' : 'ghost'}
									size="sm"
									className="h-7 px-2 text-xs font-mono"
									onClick={() => handleSizeChange(size)}
								>
									{size.toUpperCase()}
								</Button>
							))}
						</div>
					</div>
				</DialogHeader>
				{videoUrl && (
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
				)}
			</DialogContent>
		</Dialog>
	);
}
