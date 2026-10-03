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
  status: 'update-status',
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

export interface UpdateDetails {
  status: 'available' | 'downloaded';
  version: string;
  changelog: string | null;
  changelogLoading: boolean;
  isPortable: boolean;
}

export type UpdateState =
  | { status: 'idle'; update: null; error?: never; progress?: never }
  | { status: 'not-available'; update: null; error?: never; progress?: never }
  | {
      status: 'checking';
      update: UpdateDetails | null;
      error?: never;
      progress?: never;
    }
  | {
      status: 'cancelled';
      update: UpdateDetails | null;
      error?: never;
      progress?: never;
    }
  | {
      status: 'available';
      update: UpdateDetails;
      error?: never;
      progress?: never;
    }
  | {
      status: 'downloaded';
      update: UpdateDetails;
      error?: never;
      progress?: never;
    }
  | {
      status: 'downloading';
      update: UpdateDetails;
      progress?: UpdateProgress;
      error?: never;
    }
  | {
      status: 'error';
      update: UpdateDetails | null;
      error: string;
      progress?: never;
    };

export type UpdateStatus = UpdateState & {
  revision: number;
  availabilityEventId: number;
};

export const INITIAL_UPDATE_STATUS: UpdateStatus = {
  status: 'idle',
  update: null,
  revision: 0,
  availabilityEventId: 0,
};

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
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
}
