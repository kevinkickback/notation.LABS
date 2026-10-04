import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBackupTransfer } from '@/hooks/useBackupTransfer';
import type { BackupExportProgress, BackupSink } from '@/lib/backup/exportContract';
import { MAX_JSON_BACKUP_BYTES } from '@/lib/defaults';

const mocks = vi.hoisted(() => ({
  open: vi.fn(), export: vi.fn(), json: vi.fn(), zip: vi.fn(),
  success: vi.fn(), error: vi.fn(), report: vi.fn(),
}));
vi.mock('@/lib/backup/platformSave', () => ({ openBackupSink: mocks.open }));
vi.mock('@/lib/application/backupCommands', () => ({ createBackupTo: mocks.export, importJsonBackup: mocks.json, importZipBackup: mocks.zip }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock('@/lib/errors', () => ({ reportError: mocks.report, toUserMessage: (error: unknown) => error instanceof Error ? error.message : String(error) }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const sink: BackupSink = { write: async () => undefined, close: async () => undefined, abort: async () => undefined };

describe('backup transfers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.open.mockResolvedValue(sink);
    mocks.export.mockResolvedValue(undefined);
    mocks.json.mockResolvedValue(undefined);
    mocks.zip.mockResolvedValue(undefined);
  });

  it('reserves the transfer before destination selection and releases a cancelled picker', async () => {
    const chosen = deferred<BackupSink | null>();
    mocks.open.mockReturnValueOnce(chosen.promise);
    const { result } = renderHook(useBackupTransfer);
    let first!: Promise<void>;
    act(() => {
      first = result.current.exportBackup('json', {});
      void result.current.exportBackup('zip', {});
      void result.current.importFile(new File(['{}'], 'backup.json'), { includeVideos: true, includeSettings: false });
    });
    expect(result.current.isBusy).toBe(true);
    expect(mocks.open).toHaveBeenCalledOnce();
    expect(mocks.json).not.toHaveBeenCalled();
    await act(async () => { chosen.resolve(null); await first; });
    expect(result.current.isBusy).toBe(false);
    expect(mocks.export).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    await act(() => result.current.exportBackup('json', {}));
    expect(mocks.export).toHaveBeenCalledOnce();
  });

  it('cancels active writes silently and permits a new transfer', async () => {
    mocks.export.mockImplementationOnce(async (_sink, _format, _filter, _progress, signal: AbortSignal) => {
      await new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    });
    const { result } = renderHook(useBackupTransfer);
    let exporting!: Promise<void>;
    await act(async () => { exporting = result.current.exportBackup('zip', {}); });
    expect(result.current.exportProgress).toMatchObject({ phase: 'preparing' });
    await act(async () => { result.current.cancelExport(); await exporting; });
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(result.current.exportProgress).toBeNull();
    await act(() => result.current.exportBackup('json', {}));
    expect(mocks.success).toHaveBeenCalledWith('Data exported');
  });

  it('keeps the commit alive when cancellation or unmount follows finalization', async () => {
    const committed = deferred<void>();
    let signal!: AbortSignal;
    mocks.export.mockImplementationOnce(async (_sink, _format, _filter, progress: (value: BackupExportProgress) => void, next: AbortSignal) => {
      signal = next;
      progress({ phase: 'committing', bytesWritten: 100, current: 0, total: 0 });
      await committed.promise;
    });
    const { result, unmount } = renderHook(useBackupTransfer);
    let exporting!: Promise<void>;
    await act(async () => { exporting = result.current.exportBackup('json', {}); });
    act(() => result.current.cancelExport());
    unmount();
    expect(signal.aborted).toBe(false);
    await act(async () => { committed.resolve(); await exporting; });
    expect(mocks.success).toHaveBeenCalledWith('Data exported');
  });

  it('cancels work when the destination is selected after unmount', async () => {
    const chosen = deferred<BackupSink | null>();
    mocks.open.mockReturnValueOnce(chosen.promise);
    mocks.export.mockImplementationOnce(async (_sink, _format, _filter, _progress, signal: AbortSignal) => signal.throwIfAborted());
    const { result, unmount } = renderHook(useBackupTransfer);
    let exporting!: Promise<void>;
    act(() => { exporting = result.current.exportBackup('json', {}); });
    unmount();
    await act(async () => { chosen.resolve(sink); await exporting; });
    expect(mocks.export.mock.calls[0][4].aborted).toBe(true);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('reports save errors and clears the pending transfer', async () => {
    const failure = new Error('disk full');
    mocks.export.mockRejectedValueOnce(failure);
    const { result } = renderHook(useBackupTransfer);
    await act(() => result.current.exportBackup('json', {}));
    expect(mocks.report).toHaveBeenCalledWith('backup.export', failure);
    expect(mocks.error).toHaveBeenCalledWith('disk full');
    expect(result.current.isBusy).toBe(false);
    expect(result.current.exportProgress).toBeNull();
  });

  it.each([false, true])('imports JSON with the selected settings option (%s)', async includeSettings => {
    const read = vi.fn(async () => '{"games":[]}');
    const file = Object.assign(new File(['{}'], 'backup.json', { type: 'application/json' }), { text: read });
    const { result } = renderHook(useBackupTransfer);
    await act(() => result.current.importFile(file, { includeVideos: false, includeSettings }));
    expect(mocks.json).toHaveBeenCalledWith(file, false, includeSettings, expect.any(Function), expect.any(AbortSignal));
    expect(read).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith(includeSettings ? 'Data imported. Settings were replaced from backup.' : 'Data imported. Current settings were preserved.');
    expect(result.current.importProgress).toBeNull();
    expect(result.current.isBusy).toBe(false);
  });

  it('uses ZIP input without reading it as text, and rejects oversized JSON before reading', async () => {
    const read = vi.fn();
    const zip = Object.assign(new File(['zip'], 'BACKUP.ZIP'), { text: read });
    const oversized = Object.assign(new File([], 'backup.json'), { text: read });
    Object.defineProperty(oversized, 'size', { value: MAX_JSON_BACKUP_BYTES + 1 });
    const { result } = renderHook(useBackupTransfer);
    await act(() => result.current.importFile(zip, { includeVideos: true, includeSettings: false }));
    expect(mocks.zip).toHaveBeenCalledWith(zip, true, false, expect.any(Function), expect.any(AbortSignal));
    await act(() => result.current.importFile(oversized, { includeVideos: true, includeSettings: false }));
    expect(read).not.toHaveBeenCalled();
    expect(mocks.json).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('too large'));
    expect(result.current.isBusy).toBe(false);
  });
  it.each(['cancel', 'unmount'] as const)('cancels an active import on %s and waits for its rollback', async action => {
    let signal!: AbortSignal;
    mocks.zip.mockImplementationOnce(async (_file, _videos, _settings, _progress, next: AbortSignal) => {
      signal = next;
      await new Promise<void>((_resolve, reject) => next.addEventListener('abort', () => reject(next.reason), { once: true }));
    });
    const { result, unmount } = renderHook(useBackupTransfer);
    let importing!: Promise<void>;
    await act(async () => { importing = result.current.importFile(new File(['zip'], 'backup.zip'), { includeVideos: true, includeSettings: false }); });
    expect(result.current.isBusy).toBe(true);
    if (action === 'unmount') unmount();
    else act(() => result.current.cancelImport());
    await act(async () => importing);
    expect(signal.aborted).toBe(true);
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });
  it('does not cancel an import after atomic publication begins', async () => {
    const committed = deferred<void>();
    let signal!: AbortSignal;
    mocks.zip.mockImplementationOnce(async (_file, _videos, _settings, progress, next: AbortSignal) => {
      signal = next;
      progress({ phase: 'committing', current: 1, total: 1 });
      await committed.promise;
    });
    const { result, unmount } = renderHook(useBackupTransfer);
    let importing!: Promise<void>;
    await act(async () => { importing = result.current.importFile(new File(['zip'], 'backup.zip'), { includeVideos: true, includeSettings: false }); });
    act(() => result.current.cancelImport());
    unmount();
    expect(signal.aborted).toBe(false);
    await act(async () => { committed.resolve(); await importing; });
    expect(mocks.success).toHaveBeenCalled();
  });
});
