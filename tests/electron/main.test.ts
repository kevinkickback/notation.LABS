import { afterEach, describe, expect, it, vi } from 'vitest';

const writeFileMock = vi.fn();

async function loadMainModule() {
  vi.resetModules();

  const appEvents: Record<string, (...args: unknown[]) => unknown> = {};
  const ipcHandlers: Record<string, (...args: unknown[]) => unknown> = {};
  const browserWindows: BrowserWindowMock[] = [];

  class BrowserWindowMock {
    static getAllWindows = vi.fn(() => browserWindows);

    webContents = {
      on: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      send: vi.fn(),
    };
    loadFile = vi.fn();
    loadURL = vi.fn();
    show = vi.fn();
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
    isPackaged: false,
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
        ipcHandlers[channel] = handler;
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

  vi.doMock('node:fs/promises', () => ({
    __esModule: true,
    default: { writeFile: writeFileMock },
    writeFile: writeFileMock,
  }));

  vi.doMock('../../electron/updateManager', () => updateManagerMock);

  await import('../../electron/main');

  return {
    appEvents,
    ipcHandlers,
    browserWindows,
    dialogMock,
    sessionMock,
    shellMock,
    updateManagerMock,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  writeFileMock.mockReset();
});

describe('electron main process wiring', () => {
  it('initializes the app on ready and exposes update IPC handlers', async () => {
    const context = await loadMainModule();

    await context.appEvents.ready();

    expect(context.browserWindows).toHaveLength(2);
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
        'file:save',
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

    await expect(
      context.ipcHandlers['file:save'](
        {},
        new Uint8Array([1, 2, 3]),
        'backup.json',
        'application/json',
      ),
    ).resolves.toEqual({
      success: true,
      path: 'C:/Exports/backup.json',
    });
    expect(context.dialogMock.showSaveDialog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        defaultPath: 'backup.json',
      }),
    );
    expect(writeFileMock).toHaveBeenCalledWith(
      'C:/Exports/backup.json',
      expect.any(Buffer),
    );
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

    context.ipcHandlers['update:set-auto-check']({}, true);
    context.ipcHandlers['update:set-auto-check']({}, false);
    context.ipcHandlers['update:set-auto-check']({}, 'invalid');

    expect(
      context.updateManagerMock.startAutoCheckSchedule,
    ).toHaveBeenCalledTimes(1);
    expect(
      context.updateManagerMock.stopAutoCheckSchedule,
    ).toHaveBeenCalledTimes(1);
  });

  it('opens allowlisted links and prompts for unknown https domains', async () => {
    const context = await loadMainModule();

    await context.appEvents.ready();

    const mainWindow = context.browserWindows[1];
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

    const mainWindow = context.browserWindows[1];
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

  it('returns a cancelled result when the user dismisses the save dialog', async () => {
    const context = await loadMainModule();
    context.dialogMock.showSaveDialog.mockResolvedValueOnce({
      filePath: undefined,
      canceled: true,
    });

    await context.appEvents.ready();

    await expect(
      context.ipcHandlers['file:save'](
        {},
        new Uint8Array([1]),
        'backup.zip',
        'application/zip',
      ),
    ).resolves.toEqual({
      success: false,
      error: 'User cancelled',
    });
    expect(writeFileMock).not.toHaveBeenCalled();
  });
});
