// @vitest-environment node
import 'fake-indexeddb/auto';
import { createBackupTo } from '@/lib/application/backupCommands';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { captureBackup } from '../../helpers/backup';

const limits = vi.hoisted(() => ({ json: 100 * 1024 * 1024 }));
vi.mock('@/lib/defaults', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/defaults')>(),
  get MAX_JSON_BACKUP_BYTES() { return limits.json; },
}));

describe('scalable backup capabilities', () => {
  beforeEach(async () => {
    limits.json = 100 * 1024 * 1024;
    await Promise.all(db.tables.map(table => table.clear()));
  });
  async function seed(count: number) {
    const gameId = await indexedDbStorage.games.add({ name: 'Large library', buttonLayout: ['A'] });
    const characterId = await indexedDbStorage.characters.add({ name: 'Character', gameId });
    for (let index = 0; index < count; index++) {
      await indexedDbStorage.demoVideos.add({ id: `video-${index}`, fileName: 'demo.mp4', mimeType: 'video/mp4', data: new Blob([new Uint8Array([index % 256, 42])], { type: 'video/mp4' }) });
      await indexedDbStorage.combos.add({ name: `Combo ${index}`, characterId, notation: 'A', parsedNotation: [], tags: [], demoUrl: `local:video-${index}` });
    }
    return gameId;
  }
  it('exports and restores 1,000 distinct videos in one backup', async () => {
    await seed(1000);
    const archive = await captureBackup(true);
    await Promise.all(db.tables.map(table => table.clear()));
    await indexedDbStorage.importZip(archive, true);
    expect(await db.demoVideos.count()).toBe(1000);
    expect(await db.combos.count()).toBe(1000);
    for (const index of [0, 999]) {
      const video = await indexedDbStorage.demoVideos.get(`video-${index}`);
      expect(video?.data).toBeInstanceOf(Blob);
      expect(Array.from(new Uint8Array(await (video!.data as Blob).arrayBuffer()))).toEqual([index % 256, 42]);
    }
    expect(await db.backupSessions.count()).toBe(0);
    expect(await db.backupRecords.count()).toBe(0);
    expect(await db.mediaPayloads.count()).toBe(1000);
  }, 60_000);
  it('round trips embedded images larger than the former combined metadata allowance', async () => {
    const bytes = new Uint8Array(2 * 1024 * 1024).fill(42);
    bytes.set([0xff, 0xd8, 0xff]);
    const image = `data:image/jpeg;base64,${Buffer.from(bytes).toString('base64')}`;
    for (let index = 0; index < 4; index++) await indexedDbStorage.games.add({ name: `Cover ${index}`, logoImage: image, buttonLayout: [] });
    const archive = await captureBackup(true);
    await db.games.clear();
    await indexedDbStorage.importZip(archive);
    expect(await db.games.count()).toBe(4);
    expect((await db.games.toArray()).every(game => game.logoImage === image)).toBe(true);
  });
  it('offers ZIP when JSON exceeds its whole-document parsing budget and aborts saving', async () => {
    await seed(1);
    limits.json = 10;
    const sink = { write: vi.fn(async () => undefined), close: vi.fn(async () => undefined), abort: vi.fn(async () => undefined) };
    await expect(createBackupTo(sink, 'json')).rejects.toThrow(/ZIP/);
    expect(sink.close).not.toHaveBeenCalled();
    expect(sink.abort).toHaveBeenCalledOnce();
    expect(await db.backupSessions.count()).toBe(0);
  });
});
