import { contextBridge, ipcRenderer } from 'electron';
import { BACKUP_CHANNELS } from '../src/lib/backup/exportContract';
import {
  type CurrentChangelog,
  UPDATE_EVENT_CHANNELS,
  UPDATE_INVOKE_CHANNELS,
  type UpdateStatus,
} from '../src/lib/updater/ipcContract';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  beginBackup: (filename: string, mimeType: string) =>
    ipcRenderer.invoke(BACKUP_CHANNELS.begin, filename, mimeType),
  writeBackupChunk: (id: string, chunk: Uint8Array) =>
    ipcRenderer.invoke(BACKUP_CHANNELS.write, id, chunk),
  finishBackup: (id: string) => ipcRenderer.invoke(BACKUP_CHANNELS.finish, id),
  abortBackup: (id: string) => ipcRenderer.invoke(BACKUP_CHANNELS.abort, id),
  getBackupCapacity: (id: string) =>
    ipcRenderer.invoke(BACKUP_CHANNELS.capacity, id),
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

  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    const listener = (_event: unknown, status: UpdateStatus) =>
      callback(status);
    ipcRenderer.on(UPDATE_EVENT_CHANNELS.status, listener);
    return () =>
      ipcRenderer.removeListener(UPDATE_EVENT_CHANNELS.status, listener);
  },
});

// Type declarations for the exposed API live in src/types/electron.d.ts.
