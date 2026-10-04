// @vitest-environment node
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/storage/database';
import { importZipBackup } from '@/lib/storage/zipImport';
import { createBackupZip } from '../../helpers/zip';
import { captureBackup } from '../../helpers/backup';

const game = { id: 'g', name: 'Incoming', buttonLayout: ['A'], notationProfile: 'standard', createdAt: 1, updatedAt: 1 };
const character = { id: 'c', gameId: 'g', name: 'Fighter', createdAt: 1, updatedAt: 1 };
const video = { id: 'v', path: 'videos/v-0.bin', size: 3, fileName: 'demo.mp4', mimeType: 'video/mp4' };
const combo = { id: 'b', characterId: 'c', name: 'Combo', notation: 'A', parsedNotation: [], tags: [], demoUrl: 'local:v', sortOrder: 0, createdAt: 1, updatedAt: 1 };
const line = (value: unknown) => new TextEncoder().encode(`${JSON.stringify(value)}\n`);
async function archive(overrides: Record<string, Uint8Array> = {}, counts = { games: 1, characters: 1, videos: 1, combos: 1 }) {
  return new Blob([await createBackupZip({ version: 4, exported: '2026-10-03', counts }, {
    'games.ndjson': line(game), 'characters.ndjson': line(character), 'videos.ndjson': line(video),
    'combos.ndjson': line(combo), [video.path]: new Uint8Array([1, 2, 3]), ...overrides,
  }, 'STORE')]);
}
beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  await db.games.put({ ...game, notationProfile: 'standard', name: 'Existing' });
});
async function unchanged() {
  expect((await db.games.get('g'))?.name).toBe('Existing');
  expect(await db.combos.count()).toBe(0);
  expect(await db.mediaPayloads.count()).toBe(0);
  expect(await db.backupSessions.count()).toBe(0);
  expect(await db.backupRecords.count()).toBe(0);
}
describe('version 4 validation and rollback', () => {
  it.each(['games', 'characters'] as const)('validates inline image signatures and size in %s', async kind => {
    const oversized = new Uint8Array(2 * 1024 * 1024 + 1).fill(42);
    oversized.set([0xff, 0xd8, 0xff]);
    const images = ['data:image/jpeg;base64,AQID', 'data:text/html;base64,AQID', `data:image/jpeg;base64,${Buffer.from(oversized).toString('base64')}`];
    for (const image of images) {
      const row = kind === 'games' ? { ...game, logoImage: image } : { ...character, portraitImage: image };
      await expect(importZipBackup(await archive({ [`${kind}.ndjson`]: line(row) }), false)).rejects.toThrow(/invalid image/);
      await unchanged();
    }
  });

  it('accepts validated inline images and preserves external image URLs', async () => {
    const image = 'data:image/jpeg;base64,/9j/AA==';
    const external = 'https://example.com/portrait.png';
    await importZipBackup(await archive({ 'games.ndjson': line({ ...game, logoImage: image }), 'characters.ndjson': line({ ...character, portraitImage: external }) }), false);
    expect((await db.games.get(game.id))?.logoImage).toBe(image);
    expect((await db.characters.get(character.id))?.portraitImage).toBe(external);
  });

  it('rejects invalid inline images during export too and cleans the snapshot', async () => {
    await db.games.update('g', { logoImage: 'data:image/jpeg;base64,AQID' });
    await expect(captureBackup(true)).rejects.toThrow(/invalid image/);
    await unchanged();
  });

  it.each([
    ['duplicate records', { 'games.ndjson': new TextEncoder().encode(JSON.stringify(game) + '\n' + JSON.stringify(game) + '\n') }],
    ['orphaned characters', { 'characters.ndjson': line({ ...character, gameId: 'missing' }) }],
    ['orphaned combos', { 'combos.ndjson': line({ ...combo, characterId: 'missing' }) }],
    ['unsafe paths', { 'videos.ndjson': line({ ...video, path: '../demo.mp4' }) }],
    ['inconsistent sizes', { 'videos.ndjson': line({ ...video, size: 2 }) }],
  ] as const)('rejects %s without publishing staged records', async (_name, files) => {
    await expect(importZipBackup(await archive(files), true)).rejects.toThrow();
    await unchanged();
  });
  it('rejects a count mismatch after media staging and releases its payload', async () => {
    await expect(importZipBackup(await archive({}, { games: 1, characters: 1, videos: 1, combos: 2 }), true)).rejects.toThrow(/count/);
    await unchanged();
  });
  it('cancels after payload bytes arrive while preserving the previous library', async () => {
    const controller = new AbortController();
    await expect(importZipBackup(await archive(), true, false, progress => {
      if (progress.phase === 'videos' && progress.current === 1) controller.abort();
    }, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    await unchanged();
  });
});
