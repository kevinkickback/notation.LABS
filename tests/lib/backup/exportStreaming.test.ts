import 'fake-indexeddb/auto';
import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKUP_CHUNK_BYTES, type BackupSink } from '@/lib/backup/exportContract';
import { loadBackupSelectionData } from '@/lib/application/backupCommands';
import { db, indexedDbStorage } from '@/lib/storage/indexedDbStorage';

describe('streamed video backups', () => {
  beforeEach(async () => { await Promise.all([db.games.clear(), db.characters.clear(), db.combos.clear(), db.demoVideos.clear(), db.settings.clear()]); });
  afterEach(() => { vi.restoreAllMocks(); });
  async function seed() {
    const gameId = await indexedDbStorage.games.add({ name: 'Export game', buttonLayout: ['A'] });
    const characterId = await indexedDbStorage.characters.add({ gameId, name: 'Export character' });
    for (let i = 0; i < 3; i++) {
      await indexedDbStorage.demoVideos.add({ id: `video-${i}`, fileName: `demo-${i}.mp4`, mimeType: 'video/mp4', data: new Uint8Array(BACKUP_CHUNK_BYTES * 2 + 7).fill(i + 1).buffer });
      await indexedDbStorage.combos.add({ characterId, name: `Combo ${i}`, notation: 'A', tags: [], parsedNotation: [], demoUrl: `local:video-${i}` });
    }
    return gameId;
  }
  it('loads selection IDs without loading video buffers', async () => {
    await seed();
    const readAll = vi.spyOn(db.demoVideos, 'toArray');
    const selection = await loadBackupSelectionData();
    expect(selection[3]).toHaveLength(3);
    expect(selection[3][0]).toEqual(expect.any(String));
    expect(readAll).not.toHaveBeenCalled();
  });
  it('applies backpressure, uses bounded chunks and preserves a readable backup', async () => {
    const gameId = await seed();
    const parts: Uint8Array[] = [];
    let writing = false;
    const readVideo = vi.spyOn(db.demoVideos, 'get');
    const readAll = vi.spyOn(db.demoVideos, 'toArray');
    const close = vi.fn(() => Promise.resolve());
    const abort = vi.fn(() => Promise.resolve());
    let maxChunk = 0;
    const sink: BackupSink = { write: async chunk => {
      expect(writing).toBe(false);
      writing = true;
      maxChunk = Math.max(maxChunk, chunk.byteLength);
      if (parts.length === 1) expect(readVideo).toHaveBeenCalledTimes(1);
      parts.push(new Uint8Array(chunk));
      await new Promise(resolve => setTimeout(resolve, 0));
      writing = false;
    }, close, abort };
    const progress = vi.fn();
    await indexedDbStorage.exportTo(sink, { gameIds: [gameId] }, progress);
    expect(maxChunk).toBeLessThanOrEqual(BACKUP_CHUNK_BYTES);
    expect(readVideo).toHaveBeenCalledTimes(3);
    expect(readAll).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
    expect(abort).not.toHaveBeenCalled();
    const blob = new Blob(parts.map(part => new Uint8Array(part)));
    const zip = await JSZip.loadAsync(await blob.arrayBuffer(), { checkCRC32: true });
    const metadata = JSON.parse(await zip.file('backup.json')!.async('string'));
    expect(metadata.version).toBe(3);
    expect(metadata.demoVideos).toHaveLength(3);
    const videoDescriptor = metadata.demoVideos.find((video: { id: string }) => video.id === 'video-2');
    const restoredVideo = await zip.file(videoDescriptor.path)!.async('uint8array');
    expect(restoredVideo.byteLength).toBe(BACKUP_CHUNK_BYTES * 2 + 7);
    expect(restoredVideo.every(byte => byte === 3)).toBe(true);
    expect(progress.mock.calls[progress.mock.calls.length - 1]?.[0]).toMatchObject({ phase: 'finalizing', current: 3, total: 3 });
  });
  it('aborts the destination promptly on cancellation or a write failure', async () => {
    await seed();
    const controller = new AbortController();
    const abort = vi.fn(() => Promise.resolve());
    const close = vi.fn(() => Promise.resolve());
    await expect(indexedDbStorage.exportTo({ write: () => { controller.abort(); return Promise.resolve(); }, abort, close }, undefined, undefined, controller.signal)).rejects.toThrow();
    expect(abort).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    abort.mockClear();
    await expect(indexedDbStorage.exportTo({ write: () => Promise.reject(new Error('disk full')), abort, close })).rejects.toThrow('disk full');
    expect(abort).toHaveBeenCalledOnce();
  });
});

