import { app, BrowserWindow, net } from 'electron';
import {
	autoUpdater,
	type UpdateInfo,
	type ProgressInfo,
	CancellationToken,
} from 'electron-updater';

// Read owner/repo from electron-builder publish config
const GITHUB_OWNER = 'kevinkickback';
const GITHUB_REPO = 'notation.LABS';

export interface UpdateStatus {
	status:
		| 'idle'
		| 'checking'
		| 'available'
		| 'not-available'
		| 'downloading'
		| 'downloaded'
		| 'error';
	version?: string;
	changelog?: string;
	error?: string;
	progress?: ProgressInfo;
}

let cancellationToken: CancellationToken | null = null;
let currentStatus: UpdateStatus = { status: 'idle' };
let autoCheckTimer: ReturnType<typeof setInterval> | null = null;
let devSimInterval: ReturnType<typeof setInterval> | null = null;
let isPortableMode = false;

const AUTO_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const STARTUP_CHECK_DELAY = 5000; // 5 seconds after launch

function detectPortableMode(): boolean {
	const exePath = app.getPath('exe');
	const appDataPath = app.getPath('appData');
	const isInstalled =
		exePath.includes(appDataPath) ||
		exePath.includes('Program Files') ||
		exePath.includes('Program Files (x86)') ||
		exePath.includes('/Applications/');
	return !isInstalled;
}

function getMainWindow(): BrowserWindow | null {
	const windows = BrowserWindow.getAllWindows();
	return windows.length > 0 ? windows[0] : null;
}

function sendToRenderer(channel: string, data?: unknown) {
	const win = getMainWindow();
	if (win && !win.isDestroyed()) {
		win.webContents.send(channel, data);
	}
}

function setStatus(status: UpdateStatus) {
	currentStatus = status;
}

export async function fetchChangelog(version: string): Promise<string | null> {
	// Fetch release body from GitHub Releases API (public, no auth needed)
	const tag = `v${version}`;
	const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/${tag}`;

	try {
		const response = await net.fetch(url, {
			headers: {
				Accept: 'application/vnd.github.v3+json',
				'User-Agent': 'notation-labs-updater',
			},
		});

		if (!response.ok) return null;

		const data = (await response.json()) as { body?: string };
		return data.body ?? null;
	} catch {
		return null;
	}
}

export function initAutoUpdater() {
	const isDev = !app.isPackaged;

	// Configure auto-updater
	autoUpdater.autoDownload = false;
	autoUpdater.autoInstallOnAppQuit = false;
	autoUpdater.allowDowngrade = false;

	if (isDev) {
		// In dev mode, use dev-app-update.yml for config
		autoUpdater.forceDevUpdateConfig = true;
	}

	try {
		isPortableMode = detectPortableMode();
	} catch {
		// Portable detection may fail in dev
	}

	// --- Event handlers ---
	autoUpdater.on('checking-for-update', () => {
		setStatus({ status: 'checking' });
		sendToRenderer('update-checking');
	});

	autoUpdater.on('update-available', async (info: UpdateInfo) => {
		const changelog = await fetchChangelog(info.version);
		const status: UpdateStatus = {
			status: 'available',
			version: info.version,
			changelog: changelog ?? undefined,
		};
		setStatus(status);
		sendToRenderer('update-available', {
			version: info.version,
			changelog: changelog ?? null,
			isPortable: isPortableMode,
		});
	});

	autoUpdater.on('update-not-available', (_info: UpdateInfo) => {
		setStatus({ status: 'not-available' });
		sendToRenderer('update-not-available');
	});

	autoUpdater.on('error', (err: Error) => {
		const status: UpdateStatus = {
			status: 'error',
			error: err.message,
		};
		setStatus(status);
		sendToRenderer('update-error', { message: err.message });
	});

	autoUpdater.on('download-progress', (progress: ProgressInfo) => {
		setStatus({ status: 'downloading', progress });
		sendToRenderer('download-progress', {
			percentage: progress.percent,
			bytesPerSecond: progress.bytesPerSecond,
			total: progress.total,
			transferred: progress.transferred,
		});
	});

	autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
		setStatus({ status: 'downloaded', version: info.version });
		sendToRenderer('update-downloaded', { version: info.version });
	});
}

async function checkForUpdatePortable(): Promise<UpdateStatus> {
	const currentVersion = app.getVersion();
	const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

	try {
		setStatus({ status: 'checking' });
		sendToRenderer('update-checking');

		const response = await net.fetch(url, {
			headers: {
				Accept: 'application/vnd.github.v3+json',
				'User-Agent': 'notation-labs-updater',
			},
		});

		if (!response.ok) {
			const status: UpdateStatus = { status: 'not-available' };
			setStatus(status);
			sendToRenderer('update-not-available');
			return status;
		}

		const data = (await response.json()) as {
			tag_name?: string;
			body?: string;
		};
		const latestVersion = (data.tag_name ?? '').replace(/^v/, '');

		if (latestVersion && latestVersion !== currentVersion) {
			const status: UpdateStatus = {
				status: 'available',
				version: latestVersion,
				changelog: data.body ?? undefined,
			};
			setStatus(status);
			sendToRenderer('update-available', {
				version: latestVersion,
				changelog: data.body ?? null,
				isPortable: true,
			});
			return status;
		}

		const status: UpdateStatus = { status: 'not-available' };
		setStatus(status);
		sendToRenderer('update-not-available');
		return status;
	} catch (err) {
		const status: UpdateStatus = {
			status: 'error',
			error: (err as Error).message,
		};
		setStatus(status);
		return status;
	}
}

export async function checkForUpdate(): Promise<UpdateStatus> {
	if (!app.isPackaged) {
		const status: UpdateStatus = { status: 'not-available' };
		setStatus(status);
		sendToRenderer('update-not-available');
		return status;
	}

	// Portable builds don't have app-update.yml — check GitHub API directly
	if (isPortableMode) {
		return checkForUpdatePortable();
	}

	try {
		setStatus({ status: 'checking' });
		await autoUpdater.checkForUpdates();
		return currentStatus;
	} catch (err) {
		const status: UpdateStatus = {
			status: 'error',
			error: (err as Error).message,
		};
		setStatus(status);
		return status;
	}
}

export async function downloadUpdate(): Promise<void> {
	if (!app.isPackaged) {
		// Dev mode: simulate download progress
		const mockVersion = currentStatus.version ?? '99.0.0';
		let progress = 0;
		devSimInterval = setInterval(() => {
			progress += 20;
			sendToRenderer('download-progress', {
				percentage: Math.min(progress, 100),
				bytesPerSecond: 2_500_000,
				total: 85_000_000,
				transferred: (Math.min(progress, 100) / 100) * 85_000_000,
			});
			if (progress >= 100) {
				if (devSimInterval) clearInterval(devSimInterval);
				devSimInterval = null;
				sendToRenderer('update-downloaded', { version: mockVersion });
			}
		}, 800);
		return;
	}

	cancellationToken = new CancellationToken();
	await autoUpdater.downloadUpdate(cancellationToken);
}

export function cancelDownload(): boolean {
	if (devSimInterval) {
		clearInterval(devSimInterval);
		devSimInterval = null;
		setStatus({ status: 'idle' });
		sendToRenderer('update-cancelled');
		return true;
	}
	if (cancellationToken) {
		cancellationToken.cancel();
		cancellationToken = null;
		setStatus({ status: 'idle' });
		sendToRenderer('update-cancelled');
		return true;
	}
	return false;
}

export function installUpdate(): void {
	if (!app.isPackaged) {
		// Dev mode: just log instead of quitting
		console.log('[UpdateManager] Dev mode: skipping quitAndInstall');
		return;
	}
	autoUpdater.quitAndInstall(false, true);
}

export function getUpdateStatus(): UpdateStatus {
	return currentStatus;
}

export function startAutoCheckSchedule() {
	// Initial delayed check
	setTimeout(async () => {
		try {
			await checkForUpdate();
		} catch {
			// Silently fail on auto-check
		}
	}, STARTUP_CHECK_DELAY);

	// Periodic check
	if (autoCheckTimer) clearInterval(autoCheckTimer);
	autoCheckTimer = setInterval(async () => {
		try {
			await checkForUpdate();
		} catch {
			// Silently fail on auto-check
		}
	}, AUTO_CHECK_INTERVAL);
}

export function stopAutoCheckSchedule() {
	if (autoCheckTimer) {
		clearInterval(autoCheckTimer);
		autoCheckTimer = null;
	}
}
