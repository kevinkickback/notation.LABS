import { afterEach, describe, expect, it, vi } from 'vitest';
import { openBackupSink } from '@/lib/backup/platformSave';

describe('backup destinations', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('passes owned small buffers through the desktop bridge and binds writes to the chosen session', async () => {
    const bridge = {
      beginBackup: vi.fn(() => Promise.resolve('chosen-session')),
      writeBackupChunk: vi.fn(() => Promise.resolve()),
      finishBackup: vi.fn(() => Promise.resolve()),
      abortBackup: vi.fn(() => Promise.resolve()),
    };
    vi.stubGlobal('window', { electronAPI: bridge });
    const sink = await openBackupSink('backup.zip');
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
    expect(await openBackupSink('backup.zip')).toBeNull();
  });
  it('uses the browser file picker with owned chunks and propagates write errors', async () => {
    const write = vi.fn((_data: Blob | Uint8Array) => Promise.reject(new Error('disk full')));
    const close = vi.fn(() => Promise.resolve());
    const abort = vi.fn(() => Promise.resolve());
    const picker = vi.fn(() => Promise.resolve({ createWritable: () => Promise.resolve({ write, close, abort }) }));
    vi.stubGlobal('window', { showSaveFilePicker: picker });
    const sink = await openBackupSink('backup.zip');
    await expect(sink!.write(new Uint8Array(1024).subarray(10, 20))).rejects.toThrow('disk full');
    const chunk = write.mock.calls[0][0] as Uint8Array;
    expect(chunk.buffer.byteLength).toBe(10);
    await sink!.abort();
    expect(abort).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
  });
});

