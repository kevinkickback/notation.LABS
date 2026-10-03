import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: mocks.exposeInMainWorld },
  ipcRenderer: {
    invoke: mocks.invoke,
    on: mocks.on,
    removeListener: mocks.removeListener,
  },
}));

async function loadPreloadApi(): Promise<Window['electronAPI']> {
  vi.resetModules();
  await import('../../electron/preload');
  expect(mocks.exposeInMainWorld).toHaveBeenCalledWith(
    'electronAPI',
    expect.any(Object),
  );
  return mocks.exposeInMainWorld.mock.calls[0][1] as Window['electronAPI'];
}

describe('Electron preload bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes metadata and maps renderer commands to allowlisted IPC channels', async () => {
    const api = await loadPreloadApi();
    const buffer = new Uint8Array([1, 2, 3]);

    expect(api.platform).toBe(process.platform);
    expect(api.versions).toEqual({
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    });

    await api.checkForUpdate();
    await api.downloadUpdate();
    await api.cancelUpdate();
    await api.installUpdate();
    await api.getUpdateStatus();
    await api.setAutoCheck(true);
    await api.getAppVersion();
    await api.getCurrentChangelog();
    await api.beginBackup('backup.zip', 'application/zip');
    await api.writeBackupChunk('session', buffer);
    await api.finishBackup('session');
    await api.abortBackup('session');

    expect(mocks.invoke.mock.calls).toEqual([
      ['update:check'],
      ['update:download'],
      ['update:cancel'],
      ['update:install'],
      ['update:status'],
      ['update:set-auto-check', true],
      ['update:get-version'],
      ['update:get-current-changelog'],
      ['backup:begin', 'backup.zip', 'application/zip'],
      ['backup:write', 'session', buffer],
      ['backup:finish', 'session'],
      ['backup:abort', 'session'],
    ]);
  });

  it('forwards complete update snapshots and removes the exact listener', async () => {
    const api = await loadPreloadApi();
    const callback = vi.fn();
    const unsubscribe = api.onUpdateStatus(callback);
    const listener = mocks.on.mock.calls[0][1] as (...args: unknown[]) => void;
    const status = { status: 'checking', update: null, revision: 1, availabilityEventId: 0 };
    expect(mocks.on).toHaveBeenCalledWith('update-status', listener);
    listener({ sender: 'main' }, status);
    expect(callback).toHaveBeenCalledWith(status);
    unsubscribe();
    expect(mocks.removeListener).toHaveBeenCalledWith('update-status', listener);
    expect(Object.keys(api).filter(key => key.startsWith('on'))).toEqual(['onUpdateStatus']);
  });
});
