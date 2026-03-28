import { Button } from '@/components/ui/button';
import {
	GearSix,
	Download,
	Upload,
	Notebook,
	List as ListIcon,
} from '@phosphor-icons/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
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
		<header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50 w-full">
			<div className="container mx-auto px-2 py-3 flex flex-wrap items-center justify-between min-w-0 w-full gap-y-2">
				<div className="flex items-center gap-2 min-w-0 flex-shrink-1">
					<Notebook
						className="size-7 sm:size-8 flex-shrink-0"
						weight="duotone"
						style={{ color: 'var(--accent-color, #3b82f6)' }}
					/>
					<h1
						className="text-lg sm:text-2xl font-bold tracking-tight truncate"
						style={{ fontFamily: '"JetBrains Mono", "Courier New", monospace' }}
					>
						notation
						<span style={{ color: 'var(--accent-color, #3b82f6)' }}>.LABS</span>
					</h1>
					<span className="text-xs text-muted-foreground font-mono ml-1 self-end mb-0.5 truncate">
						{appVersion ? `v${appVersion}` : ''}
					</span>
				</div>

				{/* Desktop: show inline, Mobile: show hamburger */}
				<div className="hidden sm:flex items-center gap-2 flex-wrap min-w-0">
					<NotationGuide />
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setExportDialogOpen(true)}
						title="Export Data"
						className="flex-shrink-0"
					>
						<Upload className="size-5 sm:size-6" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={handleImportClick}
						title="Import Data"
						className="flex-shrink-0"
					>
						<Download className="size-5 sm:size-6" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setSettingsOpen(true)}
						className="flex-shrink-0"
					>
						<GearSix className="size-5 sm:size-6" />
					</Button>
				</div>

				{/* Mobile: Hamburger menu */}
				<div className="flex sm:hidden items-center">
					<DropdownMenu.Root>
						<DropdownMenu.Trigger asChild>
							<Button variant="ghost" size="icon" aria-label="Open menu">
								<ListIcon className="size-6" />
							</Button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content
							align="end"
							sideOffset={8}
							className="z-50 min-w-[10rem] rounded-md border bg-popover p-2 shadow-md"
						>
							<DropdownMenu.Item asChild>
								<Button
									variant="ghost"
									size="icon"
									className="w-full justify-start"
									// NotationGuide is a button, so we trigger its click
									onClick={() => {
										// Find the NotationGuide button in the DOM and click it
										const guideBtn = document.querySelector(
											'[data-slot="notation-guide-button"]',
										);
										if (guideBtn) (guideBtn as HTMLElement).click();
									}}
								>
									<Notebook className="size-5" />
									<span className="ml-2">Notation Guide</span>
								</Button>
							</DropdownMenu.Item>
							<DropdownMenu.Item asChild>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => setExportDialogOpen(true)}
									className="w-full justify-start"
								>
									<Upload className="size-5" />
									<span className="ml-2">Export Data</span>
								</Button>
							</DropdownMenu.Item>
							<DropdownMenu.Item asChild>
								<Button
									variant="ghost"
									size="icon"
									onClick={handleImportClick}
									className="w-full justify-start"
								>
									<Download className="size-5" />
									<span className="ml-2">Import Data</span>
								</Button>
							</DropdownMenu.Item>
							<DropdownMenu.Item asChild>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => setSettingsOpen(true)}
									className="w-full justify-start"
								>
									<GearSix className="size-5" />
									<span className="ml-2">Settings</span>
								</Button>
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
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
