import { SpinnerGap, X } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

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
	const [phase, setPhase] = useState<UpdatePhase>('downloading');
	const [percentage, setPercentage] = useState(0);
	const [bytesPerSecond, setBytesPerSecond] = useState(0);
	const [total, setTotal] = useState(0);
	const [transferred, setTransferred] = useState(0);
	const [restartCountdown, setRestartCountdown] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) {
			// reset progress state
			setPhase('downloading');
			setPercentage(0);
			setBytesPerSecond(0);
			setTotal(0);
			setTransferred(0);
			setRestartCountdown(null);
			setError(null);
			return;
		}

		const unsubs: (() => void)[] = [];

		if (window.electronAPI) {
			unsubs.push(
				window.electronAPI.onDownloadProgress((data) => {
					setPhase('downloading');
					setPercentage(data.percentage);
					setBytesPerSecond(data.bytesPerSecond);
					setTotal(data.total);
					setTransferred(data.transferred);
				}),
			);

			unsubs.push(
				window.electronAPI.onUpdateDownloaded(() => {
					setPhase('downloaded');
					setRestartCountdown(3);
				}),
			);

			unsubs.push(
				window.electronAPI.onUpdateError((data) => {
					setPhase('error');
					setError(data.message);
				}),
			);

			unsubs.push(
				window.electronAPI.onUpdateCancelled(() => {
					setPhase('cancelled');
				}),
			);
		}

		return () => {
			unsubs.forEach((unsub) => {
				unsub();
			});
		};
	}, [open]);

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
		if (restartCountdown === 0 && window.electronAPI) {
			window.electronAPI.installUpdate();
		}
	}, [restartCountdown]);

	const handleCancel = useCallback(() => {
		if (window.electronAPI) {
			window.electronAPI.cancelUpdate();
		}
	}, []);

	const handleRetry = useCallback(() => {
		setPhase('downloading');
		setPercentage(0);
		setError(null);
		if (window.electronAPI) {
			window.electronAPI.downloadUpdate();
		}
	}, []);

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
							(error ?? 'An error occurred during download.')}
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
								<X size={14} className="mr-1" />
								Cancel
							</Button>
						</div>
					</div>
				)}

				{phase === 'downloaded' && (
					<div className="flex items-center justify-center py-4">
						<SpinnerGap size={24} className="animate-spin text-primary" />
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
