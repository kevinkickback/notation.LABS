export const UPDATE_INVOKE_CHANNELS = {
  check: 'update:check',
  download: 'update:download',
  cancel: 'update:cancel',
  install: 'update:install',
  status: 'update:status',
  setAutoCheck: 'update:set-auto-check',
  getVersion: 'update:get-version',
  getCurrentChangelog: 'update:get-current-changelog',
} as const;

export const UPDATE_EVENT_CHANNELS = {
  checking: 'update-checking',
  available: 'update-available',
  notAvailable: 'update-not-available',
  error: 'update-error',
  progress: 'download-progress',
  downloaded: 'update-downloaded',
  cancelled: 'update-cancelled',
} as const;

export interface UpdateIPCResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface UpdateProgress {
  percentage: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

export interface UpdateAvailablePayload {
  version: string;
  changelog: string | null;
  isPortable: boolean;
}

export interface UpdateErrorPayload {
  message: string;
}

export interface UpdateDownloadedPayload {
  version: string;
}

export interface UpdateStatus {
  status:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'cancelled'
    | 'error';
  version?: string;
  changelog?: string;
  isPortable?: boolean;
  error?: string;
  progress?: UpdateProgress;
}

export interface CurrentChangelog {
  version: string;
  changelog: string | null;
}

export interface UpdaterBridge {
  checkForUpdate: () => Promise<UpdateIPCResponse<UpdateStatus>>;
  downloadUpdate: () => Promise<UpdateIPCResponse<null>>;
  cancelUpdate: () => Promise<UpdateIPCResponse<null>>;
  installUpdate: () => Promise<void>;
  getUpdateStatus: () => Promise<UpdateStatus>;
  setAutoCheck: (enabled: boolean) => Promise<void>;
  getAppVersion: () => Promise<string>;
  getCurrentChangelog: () => Promise<CurrentChangelog>;
  onUpdateChecking: (callback: () => void) => () => void;
  onUpdateAvailable: (
    callback: (data: UpdateAvailablePayload) => void,
  ) => () => void;
  onUpdateNotAvailable: (callback: () => void) => () => void;
  onUpdateError: (callback: (data: UpdateErrorPayload) => void) => () => void;
  onDownloadProgress: (callback: (data: UpdateProgress) => void) => () => void;
  onUpdateDownloaded: (
    callback: (data: UpdateDownloadedPayload) => void,
  ) => () => void;
  onUpdateCancelled: (callback: () => void) => () => void;
}
