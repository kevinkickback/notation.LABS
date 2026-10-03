import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isUpdateEligible } from '../../electron/updatePolicy';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
async function loadUpdateManager(options: { isPackaged?: boolean; version?: string; fetchImpl?: ReturnType<typeof vi.fn> } = {}) {
  vi.resetModules();
  const events = new EventEmitter();
  const mainWindow = { isDestroyed: vi.fn(() => false), webContents: { send: vi.fn() } };
  const netFetch = options.fetchImpl ?? vi.fn().mockResolvedValue({ ok: true, json: async () => ({ body: 'Release notes' }) });
  const shellOpenExternal = vi.fn();
  const appMock = { isPackaged: options.isPackaged ?? true, getVersion: vi.fn(() => options.version ?? '1.0.0') };
  class CancellationTokenMock {
    cancelled = false;
    cancel = vi.fn(() => { this.cancelled = true; });
  }
  const autoUpdaterMock = {
    autoDownload: true, autoInstallOnAppQuit: true, allowDowngrade: true, forceDevUpdateConfig: false,
    on: vi.fn((name: string, listener: (...args: unknown[]) => void) => events.on(name, listener)),
    checkForUpdates: vi.fn(), downloadUpdate: vi.fn(), quitAndInstall: vi.fn(),
  };
  vi.doMock('electron', () => ({
    app: appMock, BrowserWindow: { getAllWindows: () => [mainWindow] },
    net: { fetch: netFetch }, shell: { openExternal: shellOpenExternal },
  }));
  vi.doMock('electron-updater', () => ({ autoUpdater: autoUpdaterMock, CancellationToken: CancellationTokenMock }));
  const module = await import('../../electron/updateManager');
  module.initAutoUpdater();
  return { module, events, emit: events.emit.bind(events), autoUpdaterMock, mainWindow, netFetch, shellOpenExternal };
}
afterEach(() => {
  delete process.env.PORTABLE_EXECUTABLE_DIR;
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.resetModules();
});

describe('isUpdateEligible', () => {
  it.each([
    ['1.1.0', '1.0.0', true],
    ['1.0.1', '1.0', false],
    ['2.0.0', '1.9.9', true],
    ['1.0.0', '1.0.0-beta.2', true],
    ['1.0.0-beta.10', '1.0.0-beta.2', true],
    ['1.0.0-beta.2', '1.0.0-beta.10', false],
    ['2.0.0-beta.1', '1.0.0', false],
    ['not-a-version', '1.0.0', false],
    ['1.1.0', 'invalid-current', false],
  ])(
    'evaluates candidate %s against current %s',
    (candidateVersion, currentVersion, expected) => {
      expect(isUpdateEligible(candidateVersion, currentVersion)).toBe(
        expected,
      );
    },
  );
});


describe('updateManager', () => {
  it('publishes complete availability synchronously, then enriches its notes', async () => {
    const context = await loadUpdateManager();
    context.autoUpdaterMock.checkForUpdates.mockImplementation(async () => {
      context.emit('checking-for-update');
      context.emit('update-available', { version: '2.0.0' });
      return { updateInfo: { version: '2.0.0' } };
    });
    const status = await context.module.checkForUpdate();
    expect(status.status).toBe('available');
    expect(status.update?.version).toBe('2.0.0');
    await vi.waitFor(() => expect(context.module.getUpdateStatus().update?.changelog).toBe('Release notes'));
    expect(context.mainWindow.webContents.send).toHaveBeenLastCalledWith('update-status', context.module.getUpdateStatus());
  });

  it('does not await event listeners as though EventEmitter waited for their promises', async () => {
    const fetch = deferred<{ ok: boolean; json: () => Promise<{ body: string }> }>();
    const context = await loadUpdateManager({ fetchImpl: vi.fn().mockReturnValue(fetch.promise) });
    context.autoUpdaterMock.checkForUpdates.mockImplementation(async () => {
      context.emit('update-available', { version: '2.0.0' });
      return { updateInfo: { version: '2.0.0' } };
    });
    const status = await context.module.checkForUpdate();
    expect(status).toMatchObject({ status: 'available', update: { version: '2.0.0', changelogLoading: true } });
    fetch.resolve({ ok: true, json: async () => ({ body: 'Delayed notes' }) });
    await vi.waitFor(() => expect(context.module.getUpdateStatus().update?.changelog).toBe('Delayed notes'));
  });

  it('keeps a completed download when its changelog resolves later', async () => {
    const fetch = deferred<{ ok: boolean; json: () => Promise<{ body: string }> }>();
    const download = deferred<void>();
    const context = await loadUpdateManager({ fetchImpl: vi.fn().mockReturnValue(fetch.promise) });
    context.autoUpdaterMock.downloadUpdate.mockReturnValue(download.promise);
    context.emit('update-available', { version: '2.0.0' });
    const request = context.module.downloadUpdate();
    context.emit('download-progress', { percent: 60, bytesPerSecond: 3, total: 10, transferred: 6 });
    expect(context.module.getUpdateStatus()).toMatchObject({ status: 'downloading', update: { version: '2.0.0' } });
    context.emit('update-downloaded', { version: '2.0.0' });
    download.resolve();
    await request;
    fetch.resolve({ ok: true, json: async () => ({ body: 'Late notes' }) });
    await vi.waitFor(() => expect(context.module.getUpdateStatus().update?.changelog).toBe('Late notes'));
    expect(context.module.getUpdateStatus()).toMatchObject({ status: 'downloaded', update: { status: 'downloaded', version: '2.0.0' } });
    expect(context.module.getUpdateStatus().progress).toBeUndefined();
  });

  it('discards notes for an update that has been superseded', async () => {
    const first = deferred<{ ok: boolean; json: () => Promise<{ body: string }> }>();
    const context = await loadUpdateManager({ fetchImpl: vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ body: 'New notes' }) }) });
    context.emit('update-available', { version: '2.0.0' });
    context.emit('update-available', { version: '3.0.0' });
    await vi.waitFor(() => expect(context.module.getUpdateStatus().update?.changelog).toBe('New notes'));
    first.resolve({ ok: true, json: async () => ({ body: 'Old notes' }) });
    await first.promise;
    await Promise.resolve();
    await Promise.resolve();
    expect(context.module.getUpdateStatus().update).toMatchObject({ version: '3.0.0', changelog: 'New notes' });
  });

  it('does not resurrect an update cleared by a later successful check', async () => {
    const fetch = deferred<{ ok: boolean; json: () => Promise<{ body: string }> }>();
    const context = await loadUpdateManager({ fetchImpl: vi.fn().mockReturnValue(fetch.promise) });
    context.emit('update-available', { version: '2.0.0' });
    context.emit('update-not-available', { version: '1.0.0' });
    fetch.resolve({ ok: true, json: async () => ({ body: 'Old notes' }) });
    await fetch.promise;
    await Promise.resolve();
    expect(context.module.getUpdateStatus()).toMatchObject({ status: 'not-available', update: null });
  });

  it('keeps update identity and notes when a later check fails', async () => {
    const context = await loadUpdateManager();
    context.emit('update-available', { version: '2.0.0' });
    await vi.waitFor(() => expect(context.module.getUpdateStatus().update?.changelog).toBe('Release notes'));
    context.autoUpdaterMock.checkForUpdates.mockRejectedValue(new Error('Offline'));
    const status = await context.module.checkForUpdate();
    expect(status).toMatchObject({ status: 'error', error: 'Offline', update: { version: '2.0.0', changelog: 'Release notes' } });
  });

  it('reports portable HTTP failure rather than saying the app is up to date', async () => {
    process.env.PORTABLE_EXECUTABLE_DIR = 'C:/portable';
    const context = await loadUpdateManager({ fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 503 }) });
    expect(await context.module.checkForUpdate()).toMatchObject({ status: 'error', error: 'Could not check for updates (HTTP 503).' });
    expect(context.mainWindow.webContents.send).toHaveBeenLastCalledWith('update-status', context.module.getUpdateStatus());
  });

  it.each([null, {}, { tag_name: 12 }, { tag_name: 'not-a-version' }])('rejects invalid portable release metadata %j', async data => {
    process.env.PORTABLE_EXECUTABLE_DIR = 'C:/portable';
    const context = await loadUpdateManager({ fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => data }) });
    expect((await context.module.checkForUpdate()).status).toBe('error');
  });

  it('checks portable updates and opens the matching release page', async () => {
    process.env.PORTABLE_EXECUTABLE_DIR = 'C:/portable';
    const context = await loadUpdateManager({ fetchImpl: vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ tag_name: 'v1.1.0', body: 'Portable notes' }),
    }) });
    const status = await context.module.checkForUpdate();
    await context.module.downloadUpdate();
    expect(status).toMatchObject({ status: 'available', update: { version: '1.1.0', changelog: 'Portable notes', isPortable: true } });
    expect(context.shellOpenExternal).toHaveBeenCalledWith('https://github.com/kevinkickback/notation.LABS/releases/tag/v1.1.0');
  });

  it('deduplicates simultaneous checks', async () => {
    const check = deferred<{ updateInfo: { version: string } }>();
    const context = await loadUpdateManager();
    context.autoUpdaterMock.checkForUpdates.mockReturnValue(check.promise);
    const first = context.module.checkForUpdate();
    const second = context.module.checkForUpdate();
    expect(first).toBe(second);
    expect(context.autoUpdaterMock.checkForUpdates).toHaveBeenCalledOnce();
    check.resolve({ updateInfo: { version: '1.0.0' } });
    await first;
  });

  it('keeps late progress and cancellation errors from reviving a cancelled download', async () => {
    const download = deferred<void>();
    const context = await loadUpdateManager();
    context.autoUpdaterMock.downloadUpdate.mockReturnValue(download.promise);
    context.emit('update-available', { version: '2.0.0' });
    const request = context.module.downloadUpdate();
    const token = context.autoUpdaterMock.downloadUpdate.mock.calls[0][0] as { cancel: ReturnType<typeof vi.fn> };
    expect(context.module.cancelDownload()).toBe(true);
    expect(token.cancel).toHaveBeenCalledOnce();
    context.emit('download-progress', { percent: 90, bytesPerSecond: 1, total: 100, transferred: 90 });
    context.emit('update-downloaded', { version: '2.0.0' });
    context.emit('error', Object.assign(new Error('Cancelled'), { code: 'ERR_UPDATER_CANCELLED' }));
    download.reject(new Error('Cancelled'));
    await request;
    expect(context.module.getUpdateStatus()).toMatchObject({ status: 'cancelled', update: { version: '2.0.0' } });
  });

  it('checks and cancels cannot discard a ready installer, and install is gated on readiness', async () => {
    const download = deferred<void>();
    const context = await loadUpdateManager();
    context.module.installUpdate();
    expect(context.autoUpdaterMock.quitAndInstall).not.toHaveBeenCalled();
    context.emit('update-available', { version: '2.0.0' });
    context.autoUpdaterMock.downloadUpdate.mockReturnValue(download.promise);
    const request = context.module.downloadUpdate();
    context.emit('update-downloaded', { version: '2.0.0' });
    download.resolve();
    await request;
    const ready = context.module.getUpdateStatus();
    expect(context.module.cancelDownload()).toBe(false);
    expect(await context.module.checkForUpdate()).toBe(ready);
    expect(context.autoUpdaterMock.checkForUpdates).not.toHaveBeenCalled();
    context.module.installUpdate();
    expect(context.autoUpdaterMock.quitAndInstall).toHaveBeenCalledWith(true, true);
  });

  it('waits for cancellation to settle before retrying a cached package download', async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    const context = await loadUpdateManager();
    context.autoUpdaterMock.downloadUpdate.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    context.emit('update-available', { version: '2.0.0' });
    const original = context.module.downloadUpdate();
    context.module.cancelDownload();
    context.emit('checking-for-update');
    context.emit('update-available', { version: '2.0.0' });
    const retry = context.module.downloadUpdate();
    expect(context.autoUpdaterMock.downloadUpdate).toHaveBeenCalledOnce();
    first.reject(new Error('Cancelled'));
    await original;
    await vi.waitFor(() => expect(context.autoUpdaterMock.downloadUpdate).toHaveBeenCalledTimes(2));
    expect(context.module.getUpdateStatus().status).toBe('downloading');
    context.emit('update-downloaded', { version: '2.0.0' });
    second.resolve();
    await retry;
    expect(context.module.getUpdateStatus().status).toBe('downloaded');
  });

  it('reports failed downloads with their original update metadata', async () => {
    const context = await loadUpdateManager();
    context.emit('update-available', { version: '2.0.0' });
    context.autoUpdaterMock.downloadUpdate.mockRejectedValue(new Error('Download failed'));
    await expect(context.module.downloadUpdate()).rejects.toThrow('Download failed');
    expect(context.module.getUpdateStatus()).toMatchObject({ status: 'error', error: 'Download failed', update: { version: '2.0.0' } });
  });

  it('uses the same snapshots for development simulation and cancellation', async () => {
    vi.useFakeTimers();
    const context = await loadUpdateManager({ isPackaged: false });
    await context.module.downloadUpdate();
    await vi.advanceTimersByTimeAsync(800);
    expect(context.module.getUpdateStatus()).toMatchObject({ status: 'downloading', update: { version: '99.0.0' }, progress: { percentage: 20 } });
    expect(context.module.cancelDownload()).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(context.module.getUpdateStatus().status).toBe('cancelled');
  });

  it('publishes strictly increasing revisions and does not register listeners twice', async () => {
    const context = await loadUpdateManager();
    context.module.initAutoUpdater();
    expect(context.autoUpdaterMock.on).toHaveBeenCalledTimes(6);
    context.emit('checking-for-update');
    context.emit('update-not-available');
    const revisions = context.mainWindow.webContents.send.mock.calls.map(call => call[1].revision as number);
    expect(revisions).toEqual([1, 2]);
  });

  it('deduplicates scheduled checks and stops both timers', async () => {
    vi.useFakeTimers();
    const context = await loadUpdateManager();
    context.autoUpdaterMock.checkForUpdates.mockResolvedValue(undefined);
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
