import { afterEach, describe, expect, it, vi } from 'vitest';

type LoadUpdateManagerOptions = {
  isPackaged?: boolean;
  version?: string;
  fetchImpl?: ReturnType<typeof vi.fn>;
  checkForUpdatesImpl?: ReturnType<typeof vi.fn>;
  downloadUpdateImpl?: ReturnType<typeof vi.fn>;
};

async function loadUpdateManager(options: LoadUpdateManagerOptions = {}) {
  vi.resetModules();

  const updaterHandlers = new Map<
    string,
    Array<(...args: unknown[]) => unknown>
  >();
  const mainWindow = {
    isDestroyed: vi.fn(() => false),
    webContents: { send: vi.fn() },
  };
  const appMock = {
    isPackaged: options.isPackaged ?? false,
    getVersion: vi.fn(() => options.version ?? '1.0.0'),
  };
  const netFetch = options.fetchImpl ?? vi.fn();
  const shellOpenExternal = vi.fn();

  class CancellationTokenMock {
    cancel = vi.fn();
  }

  const autoUpdaterMock = {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    allowDowngrade: true,
    forceDevUpdateConfig: false,
    on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
      const handlers = updaterHandlers.get(event) ?? [];
      handlers.push(handler);
      updaterHandlers.set(event, handlers);
      return autoUpdaterMock;
    }),
    checkForUpdates: options.checkForUpdatesImpl ?? vi.fn(),
    downloadUpdate: options.downloadUpdateImpl ?? vi.fn(),
    quitAndInstall: vi.fn(),
  };

  vi.doMock('electron', () => ({
    app: appMock,
    BrowserWindow: {
      getAllWindows: vi.fn(() => [mainWindow]),
    },
    net: { fetch: netFetch },
    shell: { openExternal: shellOpenExternal },
  }));

  vi.doMock('electron-updater', () => ({
    autoUpdater: autoUpdaterMock,
    CancellationToken: CancellationTokenMock,
  }));

  const module = await import('../../electron/updateManager');
  const emit = async (event: string, ...args: unknown[]) => {
    for (const handler of updaterHandlers.get(event) ?? []) {
      await handler(...args);
    }
  };

  return {
    module,
    appMock,
    netFetch,
    shellOpenExternal,
    autoUpdaterMock,
    mainWindow,
    emit,
  };
}

afterEach(() => {
  delete process.env.PORTABLE_EXECUTABLE_DIR;
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.resetModules();
});

describe('updateManager', () => {
  it('checks standard packaged updates and forwards availability to the renderer', async () => {
    const context = await loadUpdateManager({
      isPackaged: true,
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ body: 'Bug fixes and balance updates' }),
      }),
    });

    context.autoUpdaterMock.checkForUpdates.mockImplementation(async () => {
      await context.emit('checking-for-update');
      await context.emit('update-available', { version: '2.0.0' });
    });

    context.module.initAutoUpdater();
    const status = await context.module.checkForUpdate();

    expect(status).toEqual({
      status: 'available',
      version: '2.0.0',
      changelog: 'Bug fixes and balance updates',
    });
    expect(context.mainWindow.webContents.send).toHaveBeenCalledWith(
      'update-available',
      {
        version: '2.0.0',
        changelog: 'Bug fixes and balance updates',
        isPortable: false,
      },
    );
  });

  it('uses the GitHub releases API for portable builds and opens the matching release page', async () => {
    process.env.PORTABLE_EXECUTABLE_DIR = 'C:/portable';
    const context = await loadUpdateManager({
      isPackaged: true,
      version: '1.0.0',
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          tag_name: 'v1.1.0',
          body: 'Portable release notes',
        }),
      }),
    });

    context.module.initAutoUpdater();
    const status = await context.module.checkForUpdate();
    await context.module.downloadUpdate();

    expect(status).toEqual({
      status: 'available',
      version: '1.1.0',
      changelog: 'Portable release notes',
    });
    expect(context.shellOpenExternal).toHaveBeenCalledWith(
      'https://github.com/kevinkickback/notation.LABS/releases/tag/v1.1.0',
    );
  });

  it('cancels packaged downloads and installs downloaded updates', async () => {
    const context = await loadUpdateManager({ isPackaged: true });

    context.module.initAutoUpdater();
    await context.module.downloadUpdate();

    const token = context.autoUpdaterMock.downloadUpdate.mock.calls[0][0] as {
      cancel: ReturnType<typeof vi.fn>;
    };
    expect(typeof token.cancel).toBe('function');
    expect(context.module.cancelDownload()).toBe(true);
    expect(token.cancel).toHaveBeenCalled();
    expect(context.mainWindow.webContents.send).toHaveBeenCalledWith(
      'update-cancelled',
      undefined,
    );

    context.module.installUpdate();
    expect(context.autoUpdaterMock.quitAndInstall).toHaveBeenCalledWith(
      false,
      true,
    );
  });

  it('deduplicates scheduled auto-checks when enabled repeatedly', async () => {
    vi.useFakeTimers();
    const context = await loadUpdateManager({
      isPackaged: true,
      checkForUpdatesImpl: vi.fn().mockResolvedValue(undefined),
    });

    context.module.initAutoUpdater();
    context.module.startAutoCheckSchedule();
    context.module.startAutoCheckSchedule();

    await vi.advanceTimersByTimeAsync(3000);
    expect(context.autoUpdaterMock.checkForUpdates).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(context.autoUpdaterMock.checkForUpdates).toHaveBeenCalledTimes(2);

    context.module.stopAutoCheckSchedule();
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(context.autoUpdaterMock.checkForUpdates).toHaveBeenCalledTimes(2);
  });
});
