import { Button } from '@/components/ui/button';
import {
	GearSix,
	Download,
	Upload,
	Notebook,
	List as ListIcon,
} from '@phosphor-icons/react';
import { useEffect, useState, useRef } from 'react';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { toast } from 'sonner';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { NotationGuide } from '@/components/header/NotationGuide';
import { ExportDialog } from '@/components/header/ExportDialog';
import { ImportDialog } from '@/components/header/ImportDialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const MAX_IMPORT_SIZE_BYTES = 50 * 1024 * 1024;

export function Header() {
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [exportDialogOpen, setExportDialogOpen] = useState(false);
	const [importDialogOpen, setImportDialogOpen] = useState(false);
	const [notationGuideOpen, setNotationGuideOpen] = useState(false);
	const [appVersion, setAppVersion] = useState<string>('');
	const [importOptions, setImportOptions] = useState({
		includeVideos: true,
		includeSettings: false,
	});
	const importInputRef = useRef<HTMLInputElement>(null);

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

	const handleImportClick = () => setImportDialogOpen(true);

	const handleChooseImportFile = (
		includeVideos: boolean,
		includeSettings: boolean,
	) => {
		setImportOptions({ includeVideos, includeSettings });
		setImportDialogOpen(false);
		importInputRef.current?.click();
	};

	const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (file.size > MAX_IMPORT_SIZE_BYTES) {
			toast.error('Import file exceeds 50 MB limit');
			e.target.value = '';
			return;
		}
		try {
			const text = await file.text();
			await indexedDbStorage.import(
				text,
				importOptions.includeVideos,
				importOptions.includeSettings,
			);
			toast.success(
				importOptions.includeSettings
					? 'Data imported. Settings were replaced from backup.'
					: 'Data imported. Current settings were preserved.',
			);
		} catch {
			toast.error('Failed to import data');
		}
		setImportOptions({ includeVideos: true, includeSettings: false });
		e.target.value = '';
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
					<NotationGuide
						open={notationGuideOpen}
						onOpenChange={setNotationGuideOpen}
					/>
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
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" aria-label="Open menu">
								<ListIcon className="size-6" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							sideOffset={8}
							className="z-50 min-w-[10rem] rounded-md border bg-popover p-2 shadow-md"
						>
							<DropdownMenuItem asChild>
								<Button
									variant="ghost"
									size="icon"
									className="w-full justify-start"
									onClick={() => setNotationGuideOpen(true)}
								>
									<Notebook className="size-5" />
									<span className="ml-2">Notation Guide</span>
								</Button>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => setExportDialogOpen(true)}
									className="w-full justify-start"
								>
									<Upload className="size-5" />
									<span className="ml-2">Export Data</span>
								</Button>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Button
									variant="ghost"
									size="icon"
									onClick={handleImportClick}
									className="w-full justify-start"
								>
									<Download className="size-5" />
									<span className="ml-2">Import Data</span>
								</Button>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => setSettingsOpen(true)}
									className="w-full justify-start"
								>
									<GearSix className="size-5" />
									<span className="ml-2">Settings</span>
								</Button>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			<SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
			<ExportDialog
				open={exportDialogOpen}
				onOpenChange={setExportDialogOpen}
				onExport={handleExport}
			/>
			<ImportDialog
				open={importDialogOpen}
				onOpenChange={setImportDialogOpen}
				onChooseFile={handleChooseImportFile}
			/>
			<input
				ref={importInputRef}
				type="file"
				accept="application/json"
				className="hidden"
				onChange={handleImportChange}
			/>
		</header>
	);
}
