import { afterEach, describe, expect, it, vi } from 'vitest';

const mkdirSyncMock = vi.fn();

type LoadMainModuleOptions = {
  mainLoadError?: Error;
  instanceLock?: boolean;
};

async function loadMainModule(loadOptions: LoadMainModuleOptions = {}) {
  vi.resetModules();

  const appEvents: Record<string, (...args: unknown[]) => unknown> = {};
  const ipcHandlers: Record<string, (...args: unknown[]) => unknown> = {};
  const rawIpcHandlers: Record<string, (...args: unknown[]) => unknown> = {};
  const browserWindows: BrowserWindowMock[] = [];
  const backupWriterMock = {
    recover: vi.fn(async () => undefined),
    availableBytes: vi.fn(async () => 1024 ** 3),
    begin: vi.fn(async () => 'backup-session'),
    write: vi.fn(async () => undefined),
    finish: vi.fn(async () => undefined),
    abort: vi.fn(async () => undefined),
  };

  class BrowserWindowMock {
    static getAllWindows = vi.fn(() => browserWindows);

    webContents = {
      on: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      send: vi.fn(),
      mainFrame: {},
      isDestroyed: vi.fn(() => false),
    };
    loadFile = vi.fn(async () => {
      if (loadOptions.mainLoadError) {
        throw loadOptions.mainLoadError;
      }
    });
    loadURL = vi.fn(async () => {
      if (loadOptions.mainLoadError) {
        throw loadOptions.mainLoadError;
      }
    });
    show = vi.fn();
    focus = vi.fn();
    restore = vi.fn();
    isMinimized = vi.fn(() => false);
    center = vi.fn();
    close = vi.fn();
    isDestroyed = vi.fn(() => false);
    on = vi.fn();
    once = vi.fn((event: string, callback: () => void) => {
      if (event === 'ready-to-show') callback();
    });

    constructor(public options: unknown) {
      browserWindows.push(this);
    }
  }

  const appMock = {
    commandLine: { appendSwitch: vi.fn() },
    isPackaged: false,
    getPath: vi.fn(() => 'C:/Profiles/notation-labs'),
    setPath: vi.fn(),
    requestSingleInstanceLock: vi.fn(() => loadOptions.instanceLock ?? true),
    getVersion: vi.fn(() => '1.3.0'),
    quit: vi.fn(),
    on: vi.fn((event: string, callback: (...args: unknown[]) => unknown) => {
      appEvents[event] = callback;
    }),
  };
  const sessionMock = {
    defaultSession: {
      webRequest: { onHeadersReceived: vi.fn() },
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn(),
    },
  };
  const dialogMock = {
    showSaveDialog: vi.fn<
      () => Promise<{ filePath?: string; canceled: boolean }>
    >(async () => ({
      filePath: 'C:/Exports/backup.json',
      canceled: false,
    })),
    showMessageBox: vi.fn<() => Promise<{ response: number }>>(async () => ({
      response: 1,
    })),
  };
  const ipcMainMock = {
    handle: vi.fn(
      (channel: string, handler: (...args: unknown[]) => unknown) => {
        rawIpcHandlers[channel] = handler;
        ipcHandlers[channel] = (...args: unknown[]) => {
          const webContents = browserWindows[browserWindows.length - 1]?.webContents;
          return handler(
            {
              sender: webContents,
              senderFrame: webContents?.mainFrame,
            },
            ...args,
          );
        };
      },
    ),
  };
  const shellMock = { openExternal: vi.fn() };
  const updateManagerMock = {
    cancelDownload: vi.fn(() => true),
    checkForUpdate: vi.fn(async () => ({ status: 'available' })),
    downloadUpdate: vi.fn(async () => undefined),
    fetchChangelog: vi.fn(async () => 'Current changelog'),
    getUpdateStatus: vi.fn(() => ({ status: 'idle' })),
    initAutoUpdater: vi.fn(),
    installUpdate: vi.fn(),
    startAutoCheckSchedule: vi.fn(),
    stopAutoCheckSchedule: vi.fn(),
  };

  vi.doMock('electron', () => ({
    app: appMock,
    BrowserWindow: BrowserWindowMock,
    dialog: dialogMock,
    ipcMain: ipcMainMock,
    session: sessionMock,
    shell: shellMock,
  }));

  vi.doMock('node:fs', () => ({ __esModule: true, default: { mkdirSync: mkdirSyncMock }, mkdirSync: mkdirSyncMock }));

  vi.doMock('../../electron/updateManager', () => updateManagerMock);
  vi.doMock('../../electron/backupWriter', () => ({ BackupWriter: class { constructor() { return backupWriterMock; } } }));

  await import('../../electron/main');

  return {
    appEvents,
    appMock,
    ipcHandlers,
    rawIpcHandlers,
    browserWindows,
    dialogMock,
    sessionMock,
    shellMock,
    updateManagerMock,
    backupWriterMock,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('electron main process wiring', () => {
  it('initializes the app on ready and exposes update IPC handlers', async () => {
    const context = await loadMainModule();

    await context.appEvents.ready();

    expect(context.browserWindows).toHaveLength(1);
    expect(context.browserWindows[0]?.options).toMatchObject({
      width: 1200,
      height: 800,
      backgroundColor: '#080b15',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    expect(context.appMock.setPath).not.toHaveBeenCalled();
    expect(context.browserWindows[0].show).toHaveBeenCalled();
    expect(
      context.sessionMock.defaultSession.webRequest.onHeadersReceived,
    ).toHaveBeenCalled();
    expect(
      context.sessionMock.defaultSession.setPermissionRequestHandler,
    ).toHaveBeenCalled();
    expect(
      context.sessionMock.defaultSession.setPermissionCheckHandler,
    ).toHaveBeenCalled();
    expect(context.updateManagerMock.initAutoUpdater).toHaveBeenCalled();
    expect(Object.keys(context.ipcHandlers)).toEqual(
      expect.arrayContaining([
        'backup:begin',
        'update:check',
        'update:download',
        'update:cancel',
        'update:install',
        'update:status',
        'update:set-auto-check',
        'update:get-version',
        'update:get-current-changelog',
      ]),
    );

    await expect(context.ipcHandlers['update:check']()).resolves.toEqual({
      success: true,
      data: { status: 'available' },
      error: null,
    });
    await expect(context.ipcHandlers['update:download']()).resolves.toEqual({
      success: true,
      data: null,
      error: null,
    });
    expect(context.ipcHandlers['update:cancel']()).toEqual({
      success: true,
      data: null,
      error: null,
    });
    expect(context.ipcHandlers['update:status']()).toEqual({ status: 'idle' });
    expect(context.ipcHandlers['update:get-version']()).toBe('1.3.0');
    await expect(
      context.ipcHandlers['update:get-current-changelog'](),
    ).resolves.toEqual({
      version: '1.3.0',
      changelog: 'Current changelog',
    });

    await expect(context.ipcHandlers['backup:begin']('backup.json', 'application/json')).resolves.toBe('backup-session');
    expect(context.dialogMock.showSaveDialog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ defaultPath: 'backup.json', filters: [{ name: 'Notation Labs Backup', extensions: ['json'] }] }));
    expect(context.ipcHandlers['file:save']).toBeUndefined();
  });

  it('loads current renderer styles without the HTTP cache in development', async () => {
    vi.stubEnv('VITE_DEV_SERVER_URL', 'http://localhost:5173');
    const context = await loadMainModule();

    await context.appEvents.ready();

    expect(context.appMock.commandLine.appendSwitch).toHaveBeenCalledWith('disable-http-cache');
    expect(context.appMock.setPath).toHaveBeenCalledWith('userData', 'C:/Profiles/notation-labs-development');
    expect(mkdirSyncMock).toHaveBeenCalledWith('C:/Profiles/notation-labs-development', { recursive: true });
    expect(context.appMock.setPath).toHaveBeenCalledWith('sessionData', 'C:/Profiles/notation-labs-development');
    const pathCalls = context.appMock.setPath.mock.invocationCallOrder;
    expect(pathCalls[pathCalls.length - 1]).toBeLessThan(context.appMock.requestSingleInstanceLock.mock.invocationCallOrder[0]);
    expect(context.browserWindows).toHaveLength(1);
    expect(context.browserWindows[0].loadURL).toHaveBeenCalledWith('http://localhost:5173');
    expect(context.browserWindows[0].show).toHaveBeenCalled();
    expect(context.appMock.quit).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('quits a duplicate instance before opening storage or windows', async () => {
    const context = await loadMainModule({ instanceLock: false });
    await context.appEvents.ready();
    context.appEvents.activate();
    expect(context.appMock.quit).toHaveBeenCalled();
    expect(context.browserWindows).toHaveLength(0);
    expect(context.updateManagerMock.initAutoUpdater).not.toHaveBeenCalled();
    expect(context.sessionMock.defaultSession.webRequest.onHeadersReceived).not.toHaveBeenCalled();
  });

  it('restores and focuses the existing window when launched again', async () => {
    const context = await loadMainModule();
    await context.appEvents.ready();
    const window = context.browserWindows[0];
    window.isMinimized.mockReturnValue(true);
    context.appEvents['second-instance']();
    expect(window.restore).toHaveBeenCalled();
    expect(window.focus).toHaveBeenCalled();
    expect(context.browserWindows).toHaveLength(1);
  });

  it('reports a fatal startup error when the main window cannot load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const context = await loadMainModule({
      mainLoadError: new Error('missing application bundle'),
    });

    await context.appEvents.ready();

    expect(context.browserWindows).toHaveLength(1);
    expect(context.browserWindows[0].show).not.toHaveBeenCalled();
    expect(context.browserWindows[0].close).toHaveBeenCalled();
    expect(context.dialogMock.showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        title: 'Notation Labs could not start',
        detail: 'missing application bundle',
      }),
    );
    expect(context.appMock.quit).toHaveBeenCalled();
  });

  it('wraps updater errors and toggles the auto-check scheduler', async () => {
    const context = await loadMainModule();
    context.updateManagerMock.checkForUpdate.mockRejectedValueOnce(
      new Error('network down'),
    );
    context.updateManagerMock.downloadUpdate.mockRejectedValueOnce(
      new Error('disk full'),
    );

    await context.appEvents.ready();

    await expect(context.ipcHandlers['update:check']()).resolves.toEqual({
      success: false,
      data: null,
      error: 'network down',
    });
    await expect(context.ipcHandlers['update:download']()).resolves.toEqual({
      success: false,
      data: null,
      error: 'disk full',
    });

    context.ipcHandlers['update:install']();
    expect(context.updateManagerMock.installUpdate).toHaveBeenCalled();

    context.ipcHandlers['update:set-auto-check'](true);
    context.ipcHandlers['update:set-auto-check'](false);
    context.ipcHandlers['update:set-auto-check']('invalid');

    expect(
      context.updateManagerMock.startAutoCheckSchedule,
    ).toHaveBeenCalledTimes(1);
    expect(
      context.updateManagerMock.stopAutoCheckSchedule,
    ).toHaveBeenCalledTimes(1);
  });

  it('rejects privileged IPC from an untrusted renderer', async () => {
    const context = await loadMainModule();
    await context.appEvents.ready();

    await expect(
      context.rawIpcHandlers['update:check']({
        sender: {},
        senderFrame: {},
      }),
    ).rejects.toThrow('untrusted renderer');
    for (const channel of ['backup:begin', 'backup:write', 'backup:finish', 'backup:abort']) {
      await expect(context.rawIpcHandlers[channel]({ sender: {}, senderFrame: {} }, 'session', new Uint8Array([1]))).rejects.toThrow('untrusted renderer');
    }

  });

  it.each(['render-process-gone', 'did-start-navigation', 'closed', 'replaced-frame'])('does not open a backup after %s while the save dialog is pending', async (eventName) => {
    const context = await loadMainModule();
    await context.appEvents.ready();
    let finishDialog!: (result: { filePath: string; canceled: boolean }) => void;
    context.dialogMock.showSaveDialog.mockImplementationOnce(() => new Promise(resolve => { finishDialog = resolve; }));
    const pending = context.ipcHandlers['backup:begin']('backup.zip', 'application/zip');
    const window = context.browserWindows[0];
    if (eventName === 'replaced-frame') window.webContents.mainFrame = {};
    else {
      const emitter = eventName === 'closed' ? window : window.webContents;
      const callback = emitter.on.mock.calls.find(([name]) => name === eventName)?.[1] as (...args: unknown[]) => void;
      callback({}, 'file://app', false, true);
    }
    finishDialog({ filePath: 'C:/Exports/backup.zip', canceled: false });
    await expect(pending).rejects.toThrow();
    expect(context.backupWriterMock.begin).not.toHaveBeenCalled();
  });

  it('starts a backup only when the original renderer is still present', async () => {
    const context = await loadMainModule();
    await context.appEvents.ready();
    await expect(context.ipcHandlers['backup:begin']('backup.zip', 'application/zip')).resolves.toBe('backup-session');
    expect(context.backupWriterMock.begin).toHaveBeenCalledWith('C:/Exports/backup.json');
  });

  it('opens allowlisted links and prompts for unknown https domains', async () => {
    const context = await loadMainModule();

    await context.appEvents.ready();

    const mainWindow = context.browserWindows[0];
    const windowOpenHandler = mainWindow.webContents.setWindowOpenHandler.mock
      .calls[0][0] as ({ url }: { url: string }) => { action: 'deny' };

    expect(windowOpenHandler({ url: 'https://github.com' })).toEqual({
      action: 'deny',
    });
    expect(context.shellMock.openExternal).toHaveBeenCalledWith(
      'https://github.com',
    );

    context.shellMock.openExternal.mockClear();
    expect(windowOpenHandler({ url: 'https://example.com' })).toEqual({
      action: 'deny',
    });
    await Promise.resolve();
    expect(context.dialogMock.showMessageBox).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: 'Open External Link?',
        detail: 'https://example.com',
      }),
    );
    expect(context.shellMock.openExternal).not.toHaveBeenCalled();

    context.dialogMock.showMessageBox.mockClear();
    expect(windowOpenHandler({ url: 'http://example.com' })).toEqual({
      action: 'deny',
    });
    expect(context.dialogMock.showMessageBox).not.toHaveBeenCalled();
    expect(context.shellMock.openExternal).not.toHaveBeenCalled();
  });

  it('opens unknown https links when the user confirms the prompt', async () => {
    const context = await loadMainModule();
    context.dialogMock.showMessageBox.mockResolvedValueOnce({ response: 0 });

    await context.appEvents.ready();

    const mainWindow = context.browserWindows[0];
    const windowOpenHandler = mainWindow.webContents.setWindowOpenHandler.mock
      .calls[0][0] as ({ url }: { url: string }) => { action: 'deny' };

    expect(windowOpenHandler({ url: 'https://example.com/docs' })).toEqual({
      action: 'deny',
    });
    await Promise.resolve();
    expect(context.shellMock.openExternal).toHaveBeenCalledWith(
      'https://example.com/docs',
    );
  });

  it('returns cancellation without beginning a session when the save dialog is dismissed', async () => {
    const context = await loadMainModule();
    context.dialogMock.showSaveDialog.mockResolvedValueOnce({ filePath: undefined, canceled: true });
    await context.appEvents.ready();
    await expect(context.ipcHandlers['backup:begin']('backup.zip', 'application/zip')).resolves.toBeNull();
    expect(context.backupWriterMock.begin).not.toHaveBeenCalled();
  });
});
