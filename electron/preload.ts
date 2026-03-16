import { contextBridge, ipcRenderer } from 'electron';

// Expose a minimal, safe API to the renderer process via contextBridge.
// Only expose what the app actually needs — nothing more.
contextBridge.exposeInMainWorld('electronAPI', {
	platform: process.platform,
	versions: {
		electron: process.versions.electron,
		chrome: process.versions.chrome,
		node: process.versions.node,
	},
	// IGDB cover search
	searchGameCovers: (query: string) => ipcRenderer.invoke('igdb:search', query),
	getGameCoverThumbnails: (imageIds: string[]) =>
		ipcRenderer.invoke('igdb:get-thumbnails', imageIds),
	downloadGameCover: (imageId: string) =>
		ipcRenderer.invoke('igdb:download-cover', imageId),

	// Character image search (DuckDuckGo)
	searchCharacterImages: (query: string) =>
		ipcRenderer.invoke('image-search:search', query),
	getCharacterThumbnails: (urls: string[]) =>
		ipcRenderer.invoke('image-search:get-thumbnails', urls),
	downloadCharacterImage: (url: string) =>
		ipcRenderer.invoke('image-search:download', url),

	// Auto-update
	checkForUpdate: () => ipcRenderer.invoke('update:check'),
	downloadUpdate: () => ipcRenderer.invoke('update:download'),
	cancelUpdate: () => ipcRenderer.invoke('update:cancel'),
	installUpdate: () => ipcRenderer.invoke('update:install'),
	getUpdateStatus: () => ipcRenderer.invoke('update:status'),
	setAutoCheck: (enabled: boolean) =>
		ipcRenderer.invoke('update:set-auto-check', enabled),
	getAppVersion: () => ipcRenderer.invoke('update:get-version'),
	getCurrentChangelog: () =>
		ipcRenderer.invoke('update:get-current-changelog') as Promise<{
			version: string;
			changelog: string | null;
		}>,

	// Update event listeners
	onUpdateChecking: (callback: () => void) => {
		const listener = () => callback();
		ipcRenderer.on('update-checking', listener);
		return () => {
			ipcRenderer.removeListener('update-checking', listener);
		};
	},
	onUpdateAvailable: (
		callback: (data: {
			version: string;
			changelog: string | null;
			isPortable: boolean;
		}) => void,
	) => {
		const listener = (
			_event: unknown,
			data: { version: string; changelog: string | null; isPortable: boolean },
		) => callback(data);
		ipcRenderer.on(
			'update-available',
			listener as (...args: unknown[]) => void,
		);
		return () => {
			ipcRenderer.removeListener(
				'update-available',
				listener as (...args: unknown[]) => void,
			);
		};
	},
	onUpdateNotAvailable: (callback: () => void) => {
		const listener = () => callback();
		ipcRenderer.on('update-not-available', listener);
		return () => {
			ipcRenderer.removeListener('update-not-available', listener);
		};
	},
	onUpdateError: (callback: (data: { message: string }) => void) => {
		const listener = (_event: unknown, data: { message: string }) =>
			callback(data);
		ipcRenderer.on('update-error', listener as (...args: unknown[]) => void);
		return () => {
			ipcRenderer.removeListener(
				'update-error',
				listener as (...args: unknown[]) => void,
			);
		};
	},
	onDownloadProgress: (
		callback: (data: {
			percentage: number;
			bytesPerSecond: number;
			total: number;
			transferred: number;
		}) => void,
	) => {
		const listener = (
			_event: unknown,
			data: {
				percentage: number;
				bytesPerSecond: number;
				total: number;
				transferred: number;
			},
		) => callback(data);
		ipcRenderer.on(
			'download-progress',
			listener as (...args: unknown[]) => void,
		);
		return () => {
			ipcRenderer.removeListener(
				'download-progress',
				listener as (...args: unknown[]) => void,
			);
		};
	},
	onUpdateDownloaded: (callback: (data: { version: string }) => void) => {
		const listener = (_event: unknown, data: { version: string }) =>
			callback(data);
		ipcRenderer.on(
			'update-downloaded',
			listener as (...args: unknown[]) => void,
		);
		return () => {
			ipcRenderer.removeListener(
				'update-downloaded',
				listener as (...args: unknown[]) => void,
			);
		};
	},
	onUpdateCancelled: (callback: () => void) => {
		const listener = () => callback();
		ipcRenderer.on('update-cancelled', listener);
		return () => {
			ipcRenderer.removeListener('update-cancelled', listener);
		};
	},

	// Dev-only: simulate update for UI testing
	simulateUpdate: (scenario?: string) =>
		ipcRenderer.invoke('update:simulate', scenario ?? 'changelog'),
});

interface IGDBIPCResponse<T> {
	success: boolean;
	data: T | null;
	error: string | null;
}

interface IGDBSearchResult {
	igdbId: number;
	name: string;
	coverImageId: string | null;
	firstReleaseDate: number | null;
}

interface ImageSearchResult {
	title: string;
	thumbnailUrl: string;
	imageUrl: string;
	width: number;
	height: number;
}

interface UpdateIPCResponse<T> {
	success: boolean;
	data: T | null;
	error: string | null;
}

interface UpdateProgress {
	percentage: number;
	bytesPerSecond: number;
	total: number;
	transferred: number;
}

// Type declaration for the exposed API
declare global {
	interface Window {
		electronAPI: {
			platform: string;
			versions: {
				electron: string;
				chrome: string;
				node: string;
			};
			searchGameCovers: (
				query: string,
			) => Promise<IGDBIPCResponse<IGDBSearchResult[]>>;
			getGameCoverThumbnails: (
				imageIds: string[],
			) => Promise<IGDBIPCResponse<Record<string, string>>>;
			downloadGameCover: (imageId: string) => Promise<IGDBIPCResponse<string>>;

			// Character image search
			searchCharacterImages: (
				query: string,
			) => Promise<IGDBIPCResponse<ImageSearchResult[]>>;
			getCharacterThumbnails: (
				urls: string[],
			) => Promise<IGDBIPCResponse<Record<string, string>>>;
			downloadCharacterImage: (url: string) => Promise<IGDBIPCResponse<string>>;

			// Auto-update
			checkForUpdate: () => Promise<UpdateIPCResponse<unknown>>;
			downloadUpdate: () => Promise<UpdateIPCResponse<null>>;
			cancelUpdate: () => Promise<UpdateIPCResponse<null>>;
			installUpdate: () => Promise<void>;
			getUpdateStatus: () => Promise<{
				status: string;
				version?: string;
				error?: string;
			}>;
			setAutoCheck: (enabled: boolean) => Promise<void>;
			getAppVersion: () => Promise<string>;
			getCurrentChangelog: () => Promise<{
				version: string;
				changelog: string | null;
			}>;

			// Update event listeners (return unsubscribe functions)
			onUpdateChecking: (callback: () => void) => () => void;
			onUpdateAvailable: (
				callback: (data: {
					version: string;
					changelog: string | null;
					isPortable: boolean;
				}) => void,
			) => () => void;
			onUpdateNotAvailable: (callback: () => void) => () => void;
			onUpdateError: (
				callback: (data: { message: string }) => void,
			) => () => void;
			onDownloadProgress: (
				callback: (data: UpdateProgress) => void,
			) => () => void;
			onUpdateDownloaded: (
				callback: (data: { version: string }) => void,
			) => () => void;
			onUpdateCancelled: (callback: () => void) => () => void;

			// Dev-only
			simulateUpdate: (scenario?: string) => Promise<void>;
		};
	}
}
