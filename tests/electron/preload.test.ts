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
    await api.saveFile(buffer, 'backup.zip', 'application/zip');

    expect(mocks.invoke.mock.calls).toEqual([
      ['update:check'],
      ['update:download'],
      ['update:cancel'],
      ['update:install'],
      ['update:status'],
      ['update:set-auto-check', true],
      ['update:get-version'],
      ['update:get-current-changelog'],
      ['file:save', buffer, 'backup.zip', 'application/zip'],
    ]);
  });

  it.each([
    ['onUpdateChecking', 'update-checking'],
    ['onUpdateNotAvailable', 'update-not-available'],
    ['onUpdateCancelled', 'update-cancelled'],
  ] as const)(
    'forwards and unsubscribes the %s event',
    async (method, channel) => {
      const api = await loadPreloadApi();
      const callback = vi.fn();
      const unsubscribe = api[method](callback);
      const listener = mocks.on.mock.calls[0][1] as (...args: unknown[]) => void;

      expect(mocks.on).toHaveBeenCalledWith(channel, listener);
      listener({ sender: 'main' });
      expect(callback).toHaveBeenCalledWith();

      unsubscribe();
      expect(mocks.removeListener).toHaveBeenCalledWith(channel, listener);
    },
  );

  it.each([
    [
      'onUpdateAvailable',
      'update-available',
      { version: '2.0.0', changelog: 'Fixes', isPortable: false },
    ],
    ['onUpdateError', 'update-error', { message: 'network down' }],
    [
      'onDownloadProgress',
      'download-progress',
      { percentage: 50, bytesPerSecond: 100, total: 200, transferred: 100 },
    ],
    ['onUpdateDownloaded', 'update-downloaded', { version: '2.0.0' }],
  ] as const)(
    'forwards event data and unsubscribes the %s listener',
    async (method, channel, data) => {
      const api = await loadPreloadApi();
      const callback = vi.fn();
      const unsubscribe = api[method](callback as never);
      const listener = mocks.on.mock.calls[0][1] as (...args: unknown[]) => void;

      expect(mocks.on).toHaveBeenCalledWith(channel, listener);
      listener({ sender: 'main' }, data);
      expect(callback).toHaveBeenCalledWith(data);

      unsubscribe();
      expect(mocks.removeListener).toHaveBeenCalledWith(channel, listener);
    },
  );
});
