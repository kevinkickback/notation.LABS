import { contextBridge, ipcRenderer } from 'electron';
import {
  type CurrentChangelog,
  UPDATE_EVENT_CHANNELS,
  UPDATE_INVOKE_CHANNELS,
  type UpdateAvailablePayload,
  type UpdateDownloadedPayload,
  type UpdateErrorPayload,
  type UpdateProgress,
} from '../src/lib/updater/ipcContract';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },

  checkForUpdate: () => ipcRenderer.invoke(UPDATE_INVOKE_CHANNELS.check),
  downloadUpdate: () => ipcRenderer.invoke(UPDATE_INVOKE_CHANNELS.download),
  cancelUpdate: () => ipcRenderer.invoke(UPDATE_INVOKE_CHANNELS.cancel),
  installUpdate: () => ipcRenderer.invoke(UPDATE_INVOKE_CHANNELS.install),
  getUpdateStatus: () => ipcRenderer.invoke(UPDATE_INVOKE_CHANNELS.status),
  setAutoCheck: (enabled: boolean) =>
    ipcRenderer.invoke(UPDATE_INVOKE_CHANNELS.setAutoCheck, enabled),
  getAppVersion: () => ipcRenderer.invoke(UPDATE_INVOKE_CHANNELS.getVersion),
  getCurrentChangelog: () =>
    ipcRenderer.invoke(
      UPDATE_INVOKE_CHANNELS.getCurrentChangelog,
    ) as Promise<CurrentChangelog>,

  onUpdateChecking: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on(UPDATE_EVENT_CHANNELS.checking, listener);
    return () => {
      ipcRenderer.removeListener(UPDATE_EVENT_CHANNELS.checking, listener);
    };
  },
  onUpdateAvailable: (callback: (data: UpdateAvailablePayload) => void) => {
    const listener = (_event: unknown, data: UpdateAvailablePayload) =>
      callback(data);
    ipcRenderer.on(
      UPDATE_EVENT_CHANNELS.available,
      listener as (...args: unknown[]) => void,
    );
    return () => {
      ipcRenderer.removeListener(
        UPDATE_EVENT_CHANNELS.available,
        listener as (...args: unknown[]) => void,
      );
    };
  },
  onUpdateNotAvailable: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on(UPDATE_EVENT_CHANNELS.notAvailable, listener);
    return () => {
      ipcRenderer.removeListener(UPDATE_EVENT_CHANNELS.notAvailable, listener);
    };
  },
  onUpdateError: (callback: (data: UpdateErrorPayload) => void) => {
    const listener = (_event: unknown, data: UpdateErrorPayload) =>
      callback(data);
    ipcRenderer.on(
      UPDATE_EVENT_CHANNELS.error,
      listener as (...args: unknown[]) => void,
    );
    return () => {
      ipcRenderer.removeListener(
        UPDATE_EVENT_CHANNELS.error,
        listener as (...args: unknown[]) => void,
      );
    };
  },
  onDownloadProgress: (callback: (data: UpdateProgress) => void) => {
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
      UPDATE_EVENT_CHANNELS.progress,
      listener as (...args: unknown[]) => void,
    );
    return () => {
      ipcRenderer.removeListener(
        UPDATE_EVENT_CHANNELS.progress,
        listener as (...args: unknown[]) => void,
      );
    };
  },
  onUpdateDownloaded: (callback: (data: UpdateDownloadedPayload) => void) => {
    const listener = (_event: unknown, data: UpdateDownloadedPayload) =>
      callback(data);
    ipcRenderer.on(
      UPDATE_EVENT_CHANNELS.downloaded,
      listener as (...args: unknown[]) => void,
    );
    return () => {
      ipcRenderer.removeListener(
        UPDATE_EVENT_CHANNELS.downloaded,
        listener as (...args: unknown[]) => void,
      );
    };
  },
  onUpdateCancelled: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on(UPDATE_EVENT_CHANNELS.cancelled, listener);
    return () => {
      ipcRenderer.removeListener(UPDATE_EVENT_CHANNELS.cancelled, listener);
    };
  },
  saveFile: (
    buffer: Uint8Array,
    filename: string,
    mimeType: string,
  ): Promise<{ success: boolean; error?: string; path?: string }> =>
    ipcRenderer.invoke('file:save', buffer, filename, mimeType),
});

// Type declarations for the exposed API live in src/types/electron.d.ts.
