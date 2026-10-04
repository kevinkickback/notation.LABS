// @vitest-environment node
import 'fake-indexeddb/auto';
import { createBackupTo } from '@/lib/application/backupCommands';
import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKUP_CHUNK_BYTES, type BackupSink } from '@/lib/backup/exportContract';
import { loadBackupSelectionData } from '@/lib/application/backupCommands';
import { db, indexedDbStorage } from '@/lib/storage/indexedDbStorage';

describe('streamed video backups', () => {
  beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });
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
    expect(selection[3]).toBe(3);
    expect(Object.keys(selection[0][0])).toEqual(['id', 'name']);
    expect(selection[2][0]).not.toHaveProperty('parsedNotation');
    expect(selection[2][0]).not.toHaveProperty('notation');
    expect(readAll).not.toHaveBeenCalled();
  });
  it('applies backpressure, uses bounded chunks and preserves a readable backup', async () => {
    const gameId = await seed();
    const parts: Uint8Array[] = [];
    let writing = false;
    const readVideo = vi.spyOn(db.mediaPayloads, 'get');
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
    await createBackupTo(sink, 'zip', { gameIds: [gameId] }, progress);
    expect(maxChunk).toBeLessThanOrEqual(BACKUP_CHUNK_BYTES);
    expect(readVideo).toHaveBeenCalledTimes(3);
    expect(readAll).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
    expect(abort).not.toHaveBeenCalled();
    const blob = new Blob(parts.map(part => new Uint8Array(part)));
    const zip = await JSZip.loadAsync(await blob.arrayBuffer(), { checkCRC32: true });
    const metadata = JSON.parse(await zip.file('backup.json')!.async('string'));
    expect(metadata.version).toBe(4);
    expect(metadata.counts.videos).toBe(3);
    const videos = (await zip.file('videos.ndjson')!.async('string')).trim().split('\n').map(line => JSON.parse(line));
    const videoDescriptor = videos.find((video: { id: string }) => video.id === 'video-2');
    const restoredVideo = await zip.file(videoDescriptor.path)!.async('uint8array');
    expect(restoredVideo.byteLength).toBe(BACKUP_CHUNK_BYTES * 2 + 7);
    expect(restoredVideo.every(byte => byte === 3)).toBe(true);
    expect(progress.mock.calls[progress.mock.calls.length - 1]?.[0]).toMatchObject({ phase: 'committing', current: 3, total: 3 });
  });
  it('aborts the destination promptly on cancellation or a write failure', async () => {
    await seed();
    const controller = new AbortController();
    const abort = vi.fn(() => Promise.resolve());
    const close = vi.fn(() => Promise.resolve());
    await expect(createBackupTo({ write: () => { controller.abort(); return Promise.resolve(); }, abort, close }, 'zip', undefined, undefined, controller.signal)).rejects.toThrow();
    expect(abort).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    abort.mockClear();
    await expect(createBackupTo({ write: () => Promise.reject(new Error('disk full')), abort, close }, 'zip')).rejects.toThrow('disk full');
    expect(abort).toHaveBeenCalledOnce();
  });

  it('announces the non-cancellable commit before closing the destination', async () => {
    await seed();
    const phases: string[] = [];
    const controller = new AbortController();
    const abort = vi.fn(async () => undefined);
    let finishCommit!: () => void;
    const close = vi.fn(() => new Promise<void>(resolve => { finishCommit = resolve; }));
    const exporting = createBackupTo({ write: async () => undefined, close, abort }, 'zip', undefined, progress => { phases.push(progress.phase); }, controller.signal);
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(phases[phases.length - 1]).toBe('committing');
    // Close has already reached the point where a commit cannot be undone.
    controller.abort();
    finishCommit();
    await exporting;
    expect(abort).not.toHaveBeenCalled();
  });

  it('streams restorable JSON in bounded chunks without reading video data', async () => {
    const gameId = await seed();
    const game = await db.games.get(gameId);
    await db.games.put({ ...game!, notes: '日本語'.repeat(BACKUP_CHUNK_BYTES) });
    const parts: Uint8Array[] = [];
    const close = vi.fn(async () => undefined);
    const abort = vi.fn(async () => undefined);
    const readVideo = vi.spyOn(db.demoVideos, 'get');
    const phases: string[] = [];
    await createBackupTo({ write: async chunk => { expect(chunk.byteLength).toBeLessThanOrEqual(BACKUP_CHUNK_BYTES); parts.push(new Uint8Array(chunk)); }, close, abort }, 'json', undefined, value => phases.push(value.phase));
    expect(parts.length).toBeGreaterThan(1);
    const blob = new Blob(parts.map(part => new Uint8Array(part)));
    const json = await blob.text();
    const backup = JSON.parse(json);
    expect(backup.version).toBe(1);
    expect(backup.games[0].notes).toBe('日本語'.repeat(BACKUP_CHUNK_BYTES));
    expect(backup.combos.every((combo: { demoUrl?: string }) => !combo.demoUrl)).toBe(true);
    expect(readVideo).not.toHaveBeenCalled();
    expect(phases[phases.length - 1]).toBe('committing');
    expect(close).toHaveBeenCalledOnce();
    expect(abort).not.toHaveBeenCalled();
    await db.games.clear();
    await db.characters.clear();
    await db.combos.clear();
    await indexedDbStorage.import(json, false);
    expect((await db.games.get(gameId))?.notes).toBe('日本語'.repeat(BACKUP_CHUNK_BYTES));
  });

  it('aborts JSON on cancellation and preserves the original write failure if cleanup also fails', async () => {
    await seed();
    const controller = new AbortController();
    const abort = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    await expect(createBackupTo({ write: async () => { controller.abort(); }, abort, close }, 'json', undefined, undefined, controller.signal)).rejects.toThrow();
    expect(abort).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    await expect(createBackupTo({ write: async () => { throw new Error('disk full'); }, abort: async () => { throw new Error('cleanup failed'); }, close }, 'json')).rejects.toThrow('disk full');
    expect(close).not.toHaveBeenCalled();
  });

  it('aborts the chosen destination if reading a snapshot fails', async () => {
    const abort = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const write = vi.fn(async () => undefined);
    vi.spyOn(db.games, 'orderBy').mockImplementationOnce(() => { throw new Error('unavailable database'); });
    await expect(createBackupTo({ write, abort, close }, 'json')).rejects.toThrow('unavailable database');
    expect(abort).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });
});
