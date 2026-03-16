import { Button } from '@/components/ui/button';
import { GearSix, Download, Upload, Notebook } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { toast } from 'sonner';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { NotationGuide } from '@/components/combo/NotationGuide';
import { ExportDialog } from '@/components/layout/ExportDialog';

export function Header() {
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [exportDialogOpen, setExportDialogOpen] = useState(false);
	const [appVersion, setAppVersion] = useState<string>('');

	useEffect(() => {
		window.electronAPI?.getAppVersion().then(setAppVersion);
	}, []);

	const handleExport = async (
		includeVideos: boolean,
		filter: { gameIds: string[]; characterIds: string[]; comboIds: string[] },
	) => {
		setExportDialogOpen(false);
		try {
			const data = await indexedDbStorage.export(includeVideos, filter);
			const blob = new Blob([data], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `notation-labs-backup-${Date.now()}.json`;
			a.click();
			URL.revokeObjectURL(url);
			toast.success(
				includeVideos ? 'Data exported with demo videos' : 'Data exported',
			);
		} catch {
			toast.error('Failed to export data');
		}
	};

	const handleImportClick = () => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'application/json';
		input.onchange = async (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) return;
			try {
				const text = await file.text();
				await indexedDbStorage.import(text, true);
				toast.success('Data imported');
				window.location.reload();
			} catch {
				toast.error('Failed to import data');
			}
		};
		input.click();
	};

	return (
		<header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
			<div className="container mx-auto px-4 py-4 flex items-center justify-between">
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-2">
						<Notebook className="size-8 text-primary" weight="duotone" />
						<h1
							className="text-2xl font-bold tracking-tight"
							style={{
								fontFamily: '"JetBrains Mono", "Courier New", monospace',
							}}
						>
							notation<span className="text-primary">.LABS</span>
						</h1>
						<span className="text-xs text-muted-foreground font-mono ml-1 self-end mb-0.5">
							{appVersion ? `v${appVersion}` : ''}
						</span>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<NotationGuide />

					<Button
						variant="ghost"
						size="icon"
						onClick={() => setExportDialogOpen(true)}
						title="Export Data"
					>
						<Upload className="size-6" />
					</Button>

					<Button
						variant="ghost"
						size="icon"
						onClick={handleImportClick}
						title="Import Data"
					>
						<Download className="size-6" />
					</Button>

					<Button
						variant="ghost"
						size="icon"
						onClick={() => setSettingsOpen(true)}
					>
						<GearSix className="size-6" />
					</Button>
				</div>
			</div>

			<SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />

			<ExportDialog
				open={exportDialogOpen}
				onOpenChange={setExportDialogOpen}
				onExport={handleExport}
			/>
		</header>
	);
}
