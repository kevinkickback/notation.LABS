import { useState, useEffect, useCallback } from 'react';
import type { UserSettings, FontFamily } from '@/lib/types';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';

const FONT_OPTIONS: { value: FontFamily; label: string; style: string }[] = [
	{
		value: 'system-ui',
		label: 'System Default',
		style: 'system-ui, -apple-system, sans-serif',
	},
	{
		value: 'jetbrains-mono',
		label: 'JetBrains Mono',
		style: '"JetBrains Mono", monospace',
	},
	{ value: 'verdana', label: 'Verdana', style: 'Verdana, Geneva, sans-serif' },
	{
		value: 'space-grotesk',
		label: 'Space Grotesk',
		style: '"Space Grotesk", sans-serif',
	},
];

// eslint-disable-next-line react-refresh/only-export-components
export function getFontFamilyCSS(fontFamily: FontFamily): string {
	return (
		FONT_OPTIONS.find((f) => f.value === fontFamily)?.style ??
		FONT_OPTIONS[0].style
	);
}
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
	ArrowsClockwise,
	SpinnerGap,
	CheckCircle,
	WarningCircle,
	Scroll,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { ChangelogModal } from '@/components/layout/ChangelogModal';
import { UpdateProgressModal } from '@/components/layout/UpdateProgressModal';

export function GeneralSettings() {
	const [settings, setSettings] = useState<UserSettings | null>(null);
	const [loading, setLoading] = useState(true);

	// Update state
	const [updateChecking, setUpdateChecking] = useState(false);
	const [updateStatus, setUpdateStatus] = useState<
		'idle' | 'up-to-date' | 'available' | 'error'
	>('idle');
	const [updateVersion, setUpdateVersion] = useState<string | null>(null);
	const [updateChangelog, setUpdateChangelog] = useState<string | null>(null);
	const [showChangelog, setShowChangelog] = useState(false);
	const [showProgress, setShowProgress] = useState(false);
	const [showCurrentChangelog, setShowCurrentChangelog] = useState(false);
	const [currentChangelog, setCurrentChangelog] = useState<string | null>(null);
	const [changelogLoading, setChangelogLoading] = useState(false);
	const [appVersion, setAppVersion] = useState<string | null>(null);

	const loadSettings = useCallback(async () => {
		setLoading(true);
		const s = await indexedDbStorage.settings.get();
		setSettings(s);
		setLoading(false);
	}, []);

	useEffect(() => {
		loadSettings();
	}, [loadSettings]);

	useEffect(() => {
		if (window.electronAPI?.getAppVersion) {
			window.electronAPI.getAppVersion().then(setAppVersion);
		}
	}, []);

	const handleCheckForUpdate = useCallback(async () => {
		if (!window.electronAPI?.checkForUpdate) {
			toast.error('Updates are not available in dev mode');
			return;
		}

		setUpdateChecking(true);
		setUpdateStatus('idle');

		try {
			const result = await window.electronAPI.checkForUpdate();
			if (!result.success) {
				setUpdateStatus('error');
				toast.error(result.error ?? 'Failed to check for updates');
				return;
			}
		} catch {
			setUpdateStatus('error');
			toast.error('Could not check for updates. Please try again.');
		} finally {
			setUpdateChecking(false);
		}
	}, []);

	// Listen for update events from main process
	useEffect(() => {
		if (!window.electronAPI) return;

		const unsubs: (() => void)[] = [];

		if (window.electronAPI.onUpdateAvailable) {
			unsubs.push(
				window.electronAPI.onUpdateAvailable((data) => {
					setUpdateChecking(false);
					setUpdateStatus('available');
					setUpdateVersion(data.version);
					setUpdateChangelog(data.changelog);
					setShowChangelog(true);
				}),
			);
		}

		if (window.electronAPI.onUpdateNotAvailable) {
			unsubs.push(
				window.electronAPI.onUpdateNotAvailable(() => {
					setUpdateChecking(false);
					setUpdateStatus('up-to-date');
				}),
			);
		}

		if (window.electronAPI.onUpdateError) {
			unsubs.push(
				window.electronAPI.onUpdateError((data) => {
					setUpdateChecking(false);
					setUpdateStatus('error');
					toast.error(data.message);
				}),
			);
		}

		return () => {
			unsubs.forEach((unsub) => {
				unsub();
			});
		};
	}, []);

	const handleInstallUpdate = useCallback(() => {
		setShowChangelog(false);
		setShowProgress(true);
		if (window.electronAPI?.downloadUpdate) {
			window.electronAPI.downloadUpdate();
		}
	}, []);

	const updateSetting = async <K extends keyof UserSettings>(
		key: K,
		value: UserSettings[K],
	) => {
		await indexedDbStorage.settings.update({ [key]: value });
		setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
		useAppStore.getState().notifySettingsChanged();
	};

	if (loading || !settings) return null;

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Appearance</CardTitle>
					<CardDescription>
						Customize the look and feel of the app
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<Label>Theme</Label>
							<p className="text-sm text-muted-foreground">
								Choose between light and dark mode
							</p>
						</div>
						<Select
							value={settings.colorTheme}
							onValueChange={(v) => {
								updateSetting('colorTheme', v as 'light' | 'dark');
								if (v === 'dark') {
									document.documentElement.classList.add('dark');
								} else {
									document.documentElement.classList.remove('dark');
								}
							}}
						>
							<SelectTrigger className="w-32">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="dark">Dark</SelectItem>
								<SelectItem value="light">Light</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="flex items-center justify-between">
						<div>
							<Label>Font</Label>
							<p className="text-sm text-muted-foreground">
								Choose the app font family
							</p>
						</div>
						<Select
							value={settings.fontFamily}
							onValueChange={(v) => {
								const font = v as FontFamily;
								updateSetting('fontFamily', font);
								document.documentElement.style.setProperty(
									'--app-font-family',
									getFontFamilyCSS(font),
								);
							}}
						>
							<SelectTrigger className="w-44">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{FONT_OPTIONS.map((opt) => (
									<SelectItem
										key={opt.value}
										value={opt.value}
										style={{ fontFamily: opt.style }}
									>
										{opt.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Updates</CardTitle>
					<CardDescription>
						{appVersion
							? `Current version: v${appVersion}`
							: 'Manage app updates'}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<Label>Auto-Update</Label>
							<p className="text-sm text-muted-foreground">
								Check for updates automatically on launch
							</p>
						</div>
						<Switch
							checked={settings.autoUpdate ?? true}
							onCheckedChange={(v) => {
								updateSetting('autoUpdate', v);
								if (window.electronAPI?.setAutoCheck) {
									window.electronAPI.setAutoCheck(v);
								}
								toast.success(
									v ? 'Auto-update enabled' : 'Auto-update disabled',
								);
							}}
						/>
					</div>

					<div className="flex items-center justify-between">
						<div>
							<Label>Check for Updates</Label>
							<p className="text-sm text-muted-foreground">
								{updateStatus === 'up-to-date' && (
									<span className="inline-flex items-center gap-1 text-green-500">
										<CheckCircle size={14} weight="fill" /> Up to date
									</span>
								)}
								{updateStatus === 'error' && (
									<span className="inline-flex items-center gap-1 text-destructive">
										<WarningCircle size={14} weight="fill" /> Check failed
									</span>
								)}
								{updateStatus === 'available' && updateVersion && (
									<span className="text-primary">
										v{updateVersion} available
									</span>
								)}
								{updateStatus === 'idle' && 'Manually check for a new version'}
							</p>
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={handleCheckForUpdate}
							disabled={updateChecking}
						>
							{updateChecking ? (
								<SpinnerGap size={16} className="animate-spin mr-1" />
							) : (
								<ArrowsClockwise size={16} className="mr-1" />
							)}
							{updateChecking ? 'Checking...' : 'Check Now'}
						</Button>
					</div>

					<div className="flex items-center justify-between">
						<div>
							<Label>Changelog</Label>
							<p className="text-sm text-muted-foreground">
								View what's new in the current version
							</p>
						</div>
						<Button
							variant="outline"
							size="sm"
							disabled={changelogLoading}
							onClick={async () => {
								if (!window.electronAPI?.getCurrentChangelog) {
									toast.error('Not available in dev mode');
									return;
								}
								setChangelogLoading(true);
								try {
									const result = await window.electronAPI.getCurrentChangelog();
									setCurrentChangelog(result.changelog);
									setShowCurrentChangelog(true);
								} catch {
									toast.error('Failed to load changelog');
								} finally {
									setChangelogLoading(false);
								}
							}}
						>
							{changelogLoading ? (
								<SpinnerGap size={16} className="animate-spin mr-1" />
							) : (
								<Scroll size={16} className="mr-1" />
							)}
							Show Changelog
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Behavior</CardTitle>
					<CardDescription>
						Configure app behavior and preferences
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<Label>Confirm Before Delete</Label>
							<p className="text-sm text-muted-foreground">
								Show a confirmation dialog before deleting items
							</p>
						</div>
						<Switch
							checked={settings.confirmBeforeDelete ?? true}
							onCheckedChange={(v) => {
								updateSetting('confirmBeforeDelete', v);
								toast.success(
									v
										? 'Delete confirmation enabled'
										: 'Delete confirmation disabled',
								);
							}}
						/>
					</div>
				</CardContent>
			</Card>

			{/* Update Modals */}
			<ChangelogModal
				open={showChangelog}
				onOpenChange={setShowChangelog}
				version={updateVersion ?? ''}
				changelog={updateChangelog}
				onInstall={handleInstallUpdate}
			/>

			<UpdateProgressModal open={showProgress} version={updateVersion ?? ''} />

			<ChangelogModal
				open={showCurrentChangelog}
				onOpenChange={setShowCurrentChangelog}
				version={appVersion ?? ''}
				changelog={currentChangelog}
			/>
		</div>
	);
}
