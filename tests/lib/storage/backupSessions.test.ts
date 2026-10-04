// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackupTo } from '@/lib/application/backupCommands';
import { loadBackupSnapshot } from '@/lib/storage/backupSnapshot';
import { writeZipBackup } from '@/lib/backup/exportPipeline';
import { db, indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { cleanupBackupSession, createBackupSession, recoverBackupSessions, stageBackupRecord } from '@/lib/storage/backupSessionRepository';
import { stageVideoPayload } from '@/lib/storage/videoRepository';
import { captureBackup } from '../../helpers/backup';

describe('backup staging and immutable payloads', () => {
  beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });
  afterEach(() => vi.restoreAllMocks());
  async function seed() {
    const gameId = await indexedDbStorage.games.add({ name: 'Snapshot', buttonLayout: ['A'] });
    const characterId = await indexedDbStorage.characters.add({ gameId, name: 'Character' });
    await indexedDbStorage.demoVideos.add({ id: 'video', fileName: 'demo.mp4', mimeType: 'video/mp4', data: new Blob([new Uint8Array([1, 2, 3])]) });
    await indexedDbStorage.combos.add({ characterId, name: 'Combo', notation: 'A', tags: [], parsedNotation: [], demoUrl: 'local:video' });
    return gameId;
  }
  it('keeps the captured media and records stable through library replacement/deletion', async () => {
    const gameId = await seed();
    const snapshot = await loadBackupSnapshot();
    await indexedDbStorage.games.delete(gameId);
    expect(await db.demoVideos.count()).toBe(0);
    expect(await db.mediaPayloads.count()).toBe(1);
    const parts: Uint8Array<ArrayBuffer>[] = [];
    await writeZipBackup(snapshot, async chunk => { parts.push(new Uint8Array(chunk)); });
    await cleanupBackupSession(snapshot.sessionId);
    expect(await db.mediaPayloads.count()).toBe(0);
    await indexedDbStorage.importZip(new Blob(parts), true);
    expect((await db.games.get(gameId))?.name).toBe('Snapshot');
    const video = await indexedDbStorage.demoVideos.get('video');
    expect(Array.from(new Uint8Array(await (video!.data as Blob).arrayBuffer()))).toEqual([1, 2, 3]);
  });
  it('does not publish a staged import and cleans abandoned payloads idempotently', async () => {
    await seed();
    const session = await createBackupSession('import');
    const video = await stageVideoPayload({ id: 'hidden', fileName: 'new.mp4', mimeType: 'video/mp4', data: new Blob(['staged']) }, session.id);
    await stageBackupRecord(session.id, 'videos', video);
    expect(await indexedDbStorage.demoVideos.get('hidden')).toBeUndefined();
    expect(await db.mediaPayloads.count()).toBe(2);
    await recoverBackupSessions(true);
    await cleanupBackupSession(session.id);
    expect(await db.mediaPayloads.count()).toBe(1);
    expect(await db.backupRecords.count()).toBe(0);
    expect(await db.backupSessions.count()).toBe(0);
  });
  it('cancels an import during staging and preserves the old library', async () => {
    await seed();
    const archive = await captureBackup(true);
    const controller = new AbortController();
    await expect(indexedDbStorage.importZip(archive, true, false, value => { if (value.phase === 'videos') controller.abort(); }, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(await db.combos.count()).toBe(1);
    expect(await db.mediaPayloads.count()).toBe(1);
    expect(await db.backupSessions.count()).toBe(0);
  });
  it('rolls back publication after new payloads have been validated and staged', async () => {
    await seed();
    const archive = await captureBackup(true);
    const before = await db.demoVideos.get('video');
    vi.spyOn(db.games, 'bulkPut').mockRejectedValueOnce(new Error('quota exhausted'));
    await expect(indexedDbStorage.importZip(archive, true)).rejects.toThrow('quota exhausted');
    expect(await db.demoVideos.get('video')).toEqual(before);
    expect(await db.mediaPayloads.count()).toBe(1);
    expect(await db.backupSessions.count()).toBe(0);
  });
  it('cleans a failed export snapshot without changing the library', async () => {
    await seed();
    await expect(createBackupTo({ write: async () => { throw new Error('disk full'); }, close: async () => undefined, abort: async () => undefined }, 'zip')).rejects.toThrow('disk full');
    expect(await db.backupSessions.count()).toBe(0);
    expect(await db.mediaPayloads.count()).toBe(1);
  });
});
