import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, indexedDbStorage } from '@/lib/storage/indexedDbStorage';

const limits = vi.hoisted(() => ({ video: 50 * 1024 * 1024, total: 500 * 1024 * 1024, metadata: 10 * 1024 * 1024, archive: 512 * 1024 * 1024 }));
vi.mock('@/lib/defaults', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/defaults')>(),
  get MAX_VIDEO_SIZE_BYTES() { return limits.video; },
  get MAX_BACKUP_VIDEO_BYTES() { return limits.total; },
  get MAX_BACKUP_METADATA_BYTES() { return limits.metadata; },
  get MAX_ZIP_BACKUP_BYTES() { return limits.archive; },
}));

describe('restorable streaming backup limits', () => {
  beforeEach(async () => {
    Object.assign(limits, { video: 50 * 1024 * 1024, total: 500 * 1024 * 1024, metadata: 10 * 1024 * 1024, archive: 512 * 1024 * 1024 });
    await Promise.all([db.games.clear(), db.characters.clear(), db.combos.clear(), db.demoVideos.clear(), db.settings.clear()]);
  });
  async function seed(count: number, bytes = 8) {
    const gameId = await indexedDbStorage.games.add({ name: 'Limit fixture', buttonLayout: ['A'] });
    const characterId = await indexedDbStorage.characters.add({ name: 'Character', gameId });
    for (let index = 0; index < count; index++) {
      await indexedDbStorage.demoVideos.add({ id: `video-${index}`, fileName: 'demo.mp4', mimeType: 'video/mp4', data: new ArrayBuffer(bytes) });
      await indexedDbStorage.combos.add({ name: `Combo ${index}`, characterId, notation: 'A', parsedNotation: [], tags: [], demoUrl: `local:video-${index}` });
    }
  }
  function destination() {
    const parts: Uint8Array[] = [];
    return { parts, write: vi.fn(async (chunk: Uint8Array) => { parts.push(new Uint8Array(chunk)); }), close: vi.fn(async () => undefined), abort: vi.fn(async () => undefined) };
  }
  it('rejects 101 videos before writing and does not commit an unusable backup', async () => {
    await seed(101);
    const sink = destination();
    await expect(indexedDbStorage.exportTo(sink)).rejects.toThrow('at most 100 videos');
    expect(sink.write).not.toHaveBeenCalled();
    expect(sink.close).not.toHaveBeenCalled();
    expect(sink.abort).toHaveBeenCalledOnce();
  });
  it('exports and restores exactly 100 videos', async () => {
    await seed(100);
    const sink = destination();
    await indexedDbStorage.exportTo(sink);
    await db.demoVideos.clear();
    await indexedDbStorage.importZip(new Blob(sink.parts.map(part => new Uint8Array(part))), true);
    expect(await db.demoVideos.count()).toBe(100);
    expect(sink.close).toHaveBeenCalledOnce();
  });
  it.each([
    ['video', 4, 'per-video'],
    ['total', 12, '500 MB'],
    ['metadata', 10, 'metadata'],
    ['archive', 32, '512 MB'],
  ] as const)('rejects a selection exceeding the %s limit without committing', async (limit, value, message) => {
    await seed(2);
    limits[limit] = value;
    const sink = destination();
    await expect(indexedDbStorage.exportTo(sink)).rejects.toThrow(message);
    expect(sink.close).not.toHaveBeenCalled();
    expect(sink.abort).toHaveBeenCalledOnce();
  });
});
