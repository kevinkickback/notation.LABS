// @vitest-environment node
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { importZipBackup } from '@/lib/storage/zipImport';
import { createBackupZip, forgeZipSize } from '../../helpers/zip';

const metadata = { version: 3, exported: '2026-10-03', games: [], characters: [], combos: [] };
const video = { id: 'demo', fileName: 'demo.mp4', mimeType: 'video/mp4', path: 'videos/demo' };

describe('bounded ZIP imports', () => {
  beforeEach(async () => {
    await Promise.all([db.games.clear(), db.characters.clear(), db.combos.clear(), db.settings.clear(), db.demoVideos.clear()]);
    await indexedDbStorage.games.add({ name: 'Existing library', buttonLayout: ['A'] });
  });

  async function expectUnchanged() {
    expect((await db.games.toArray()).map(game => game.name)).toEqual(['Existing library']);
    expect(await db.demoVideos.count()).toBe(0);
  }

  it('rejects expanding metadata with forged small size declarations', async () => {
    const bytes = await createBackupZip({ ...metadata, padding: 'x'.repeat(1024 * 1024) });
    forgeZipSize(bytes, 'backup.json', 1);
    await expect(importZipBackup(new Blob([bytes]))).rejects.toThrow(/size/);
    await expectUnchanged();
  });

  it('rejects expanding video data before applying any backup records', async () => {
    const bytes = await createBackupZip({ ...metadata, demoVideos: [video] }, { [video.path]: new Uint8Array(1024 * 1024) });
    forgeZipSize(bytes, video.path, 1);
    await expect(importZipBackup(new Blob([bytes]), true)).rejects.toThrow(/size/);
    await expectUnchanged();
  });

  it('does not decompress videos when importing without them', async () => {
    const bytes = await createBackupZip({ ...metadata, demoVideos: [video] }, { [video.path]: new Uint8Array(1024 * 1024) });
    forgeZipSize(bytes, video.path, 1);
    await importZipBackup(new Blob([bytes]), false);
    await expectUnchanged();
  });

  it('reads large stored videos in slices rather than buffering the archive', async () => {
    const bytes = await createBackupZip({ ...metadata, demoVideos: [video] }, { [video.path]: new Uint8Array(2 * 1024 * 1024).fill(42) }, 'STORE');
    const file = new Blob([bytes]);
    const readWholeArchive = vi.spyOn(file, 'arrayBuffer');
    await importZipBackup(file, true);
    expect(readWholeArchive).not.toHaveBeenCalled();
    const data = (await indexedDbStorage.demoVideos.get(video.id))?.data;
    const restored = new Uint8Array(data && 'size' in data ? await data.arrayBuffer() : data ?? new ArrayBuffer(0));
    expect(restored.byteLength).toBe(2 * 1024 * 1024);
    expect(restored[0]).toBe(42);
    expect(restored[restored.length - 1]).toBe(42);
  });

  it('restores deflated legacy JSON backups inside ZIP files', async () => {
    await importZipBackup(new Blob([await createBackupZip({ ...metadata, version: 2 })]));
    await expectUnchanged();
  });

  it('rejects duplicate filenames rather than choosing an arbitrary payload', async () => {
    const bytes = await createBackupZip(metadata, { 'copyxx.json': new TextEncoder().encode(JSON.stringify(metadata)) });
    const source = new TextEncoder().encode('copyxx.json');
    const replacement = new TextEncoder().encode('backup.json');
    for (let offset = 0; offset + source.length <= bytes.length; offset++) {
      if (source.every((byte, index) => bytes[offset + index] === byte)) bytes.set(replacement, offset);
    }
    await expect(importZipBackup(new Blob([bytes]))).rejects.toThrow('Ambiguous archive');
    await expectUnchanged();
  });

  it('rejects truncated archives without changing the library', async () => {
    const bytes = await createBackupZip(metadata);
    await expect(importZipBackup(new Blob([bytes.subarray(0, bytes.length - 5)]))).rejects.toThrow();
    await expectUnchanged();
  });

  it('checks the integrity of entry contents', async () => {
    const bytes = await createBackupZip(metadata, {}, 'STORE');
    // The metadata payload follows the 30-byte local header and its filename.
    bytes[30 + 'backup.json'.length] ^= 1;
    await expect(importZipBackup(new Blob([bytes]))).rejects.toThrow(/CRC/);
    await expectUnchanged();
  });
});
