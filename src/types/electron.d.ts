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

export type UpdateCheckResult =
  | {
      status: 'available';
      version: string;
      changelog: string | null;
    }
  | { status: 'not-available' }
  | { status: 'error'; message: string };

declare global {
  interface Window {
    electronAPI: {
      platform: string;
      versions: {
        electron: string;
        chrome: string;
        node: string;
      };

      checkForUpdate: () => Promise<UpdateIPCResponse<UpdateCheckResult>>;
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
    };
  }
}
