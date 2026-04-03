import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },

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
});

// Type declarations for the exposed API live in src/types/electron.d.ts.
