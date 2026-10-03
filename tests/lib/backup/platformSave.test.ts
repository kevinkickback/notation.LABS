import { afterEach, describe, expect, it, vi } from 'vitest';
import { openBackupSink } from '@/lib/backup/platformSave';

describe('backup destinations', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it.each(['json', 'zip'] as const)('passes owned small buffers through the desktop bridge for %s', async format => {
    const bridge = {
      beginBackup: vi.fn(() => Promise.resolve('chosen-session')),
      writeBackupChunk: vi.fn(() => Promise.resolve()),
      finishBackup: vi.fn(() => Promise.resolve()),
      abortBackup: vi.fn(() => Promise.resolve()),
    };
    vi.stubGlobal('window', { electronAPI: bridge });
    const sink = await openBackupSink(`backup.${format}`, format);
    expect(bridge.beginBackup).toHaveBeenCalledWith(`backup.${format}`, format === 'json' ? 'application/json' : 'application/zip');
    expect(sink).not.toBeNull();
    const video = new Uint8Array(50 * 1024 * 1024);
    video[10] = 7;
    await sink!.write(video.subarray(10, 20));
    const sent = bridge.writeBackupChunk.mock.calls[0] as unknown as [string, Uint8Array];
    expect(sent[0]).toBe('chosen-session');
    expect(sent[1].byteLength).toBe(10);
    expect(sent[1].buffer.byteLength).toBe(10);
    expect(sent[1][0]).toBe(7);
    await sink!.close();
    expect(bridge.finishBackup).toHaveBeenCalledWith('chosen-session');
    await sink!.abort();
    expect(bridge.abortBackup).toHaveBeenCalledWith('chosen-session');
  });
  it('returns cancellation without creating a destination', async () => {
    vi.stubGlobal('window', { electronAPI: { beginBackup: vi.fn(() => Promise.resolve(null)) } });
    expect(await openBackupSink('backup.zip', 'zip')).toBeNull();
  });
  it('uses the browser file picker with owned chunks and propagates write errors', async () => {
    const write = vi.fn((_data: Blob | Uint8Array) => Promise.reject(new Error('disk full')));
    const close = vi.fn(() => Promise.resolve());
    const abort = vi.fn(() => Promise.resolve());
    const picker = vi.fn(() => Promise.resolve({ createWritable: () => Promise.resolve({ write, close, abort }) }));
    vi.stubGlobal('window', { showSaveFilePicker: picker });
    const sink = await openBackupSink('backup.zip', 'zip');
    await expect(sink!.write(new Uint8Array(1024).subarray(10, 20))).rejects.toThrow('disk full');
    const chunk = write.mock.calls[0][0] as Uint8Array;
    expect(chunk.buffer.byteLength).toBe(10);
    await sink!.abort();
    expect(abort).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
  });

  it.each(['json', 'zip'] as const)('selects the matching browser file type for %s and binds the native receiver', async format => {
    const picker = vi.fn(async () => ({ createWritable: async () => ({ write: async () => undefined, close: vi.fn(async () => undefined), abort: async () => undefined }) }));
    const receiver = { showSaveFilePicker: picker };
    vi.stubGlobal('window', receiver);
    const sink = await openBackupSink(`backup.${format}`, format);
    expect(picker.mock.contexts[0]).toBe(receiver);
    expect(picker).toHaveBeenCalledWith({ suggestedName: `backup.${format}`, types: [{ description: 'Notation Labs Backup', accept: { [format === 'json' ? 'application/json' : 'application/zip']: [`.${format}`] } }] });
    await sink!.close();
  });

  it('treats a cancelled browser picker as cancellation but propagates other picker failures', async () => {
    const picker = vi.fn().mockRejectedValueOnce(new DOMException('cancelled', 'AbortError')).mockRejectedValueOnce(new Error('permission denied'));
    vi.stubGlobal('window', { showSaveFilePicker: picker });
    expect(await openBackupSink('backup.json', 'json')).toBeNull();
    await expect(openBackupSink('backup.json', 'json')).rejects.toThrow('permission denied');
  });

  it('downloads correctly typed JSON only on commit and discards cancelled chunks', async () => {
    vi.stubGlobal('window', {});
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:backup');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const cancelled = await openBackupSink('cancelled.json', 'json');
    await cancelled!.write(new Uint8Array([1, 2]));
    await cancelled!.abort();
    expect(createObjectURL).not.toHaveBeenCalled();
    const completed = await openBackupSink('backup.json', 'json');
    await completed!.write(new Uint8Array([123, 125]));
    expect(click).not.toHaveBeenCalled();
    await completed!.close();
    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/json');
    expect(blob.size).toBe(2);
    expect(click).toHaveBeenCalledOnce();
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('backup.json');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
