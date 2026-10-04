// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackupZip } from '../../helpers/zip';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { COMBO_NOTATION_PARSER_VERSION, parseComboNotation } from '@/lib/parser';
import { db, indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import type { BackupImportData, Character, Combo, Game } from '@/lib/types';

const game: Game = { id: 'game', name: 'Stored game', buttonLayout: ['LP'], notationProfile: 'standard', createdAt: 1, updatedAt: 1 };
const character: Character = { id: 'character', gameId: game.id, name: 'Stored fighter', createdAt: 1, updatedAt: 1 };
const combo: Combo = { id: 'combo', characterId: character.id, name: 'Stored combo', notation: 'LP', parsedNotation: parseComboNotation('LP', ['LP']), tags: [], sortOrder: 0, createdAt: 1, updatedAt: 1 };
const data = (updates: Partial<BackupImportData> = {}): BackupImportData => ({ version: 2, exported: '2026-10-03', games: [game], characters: [character], combos: [], ...updates });

async function importData(metadata: BackupImportData, format: 'json' | 'zip', settings = false) {
  if (format === 'json') return indexedDbStorage.import(JSON.stringify(metadata), true, settings);
  const files: Record<string, Uint8Array> = {};
  const demoVideos = metadata.demoVideos?.map(video => {
    const path = `videos/${video.id}.mp4`;
    files[path] = Uint8Array.from(atob(video.dataBase64 ?? ''), value => value.charCodeAt(0));
    return { ...video, path, dataBase64: undefined };
  });
  const zip = await createBackupZip({ ...metadata, version: 3, demoVideos }, files);
  return indexedDbStorage.importZip(new Blob([zip]), true, settings);
}

describe.each(['json', 'zip'] as const)('atomic %s backup application', format => {
  beforeEach(async () => {
    await db.transaction('rw', [db.games, db.characters, db.combos, db.settings, db.demoVideos], async () => {
      await Promise.all([db.games.clear(), db.characters.clear(), db.combos.clear(), db.settings.clear(), db.demoVideos.clear()]);
      await db.games.bulkPut([game, { ...game, id: 'other-game' }]);
      await db.characters.bulkPut([character, { ...character, id: 'other-character', gameId: 'other-game' }]);
      await db.combos.bulkPut([combo, { ...combo, id: 'other-combo', characterId: 'other-character' }]);
      await db.settings.put({ id: 1, ...DEFAULT_SETTINGS, colorTheme: 'light', parsedNotationVersion: COMBO_NOTATION_PARSER_VERSION });
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('rederives imported tokens without rewriting retained combos or trusting the imported marker', async () => {
    const write = vi.spyOn(db.combos, 'bulkPut');
    await importData(data({ combos: [{ ...combo, id: 'imported', parsedNotation: [] }], settings: { ...DEFAULT_SETTINGS, parsedNotationVersion: 999, accentColor: '#123456' } }), format, true);
    expect((await db.combos.get('imported'))?.parsedNotation).toEqual(parseComboNotation('LP', ['LP']));
    const ids = write.mock.calls.flatMap(([rows]) => rows.map(row => row.id));
    expect(ids).toEqual(['imported']);
    expect((await db.settings.get(1))?.parsedNotationVersion).toBe(COMBO_NOTATION_PARSER_VERSION);
    expect((await db.settings.get(1))?.accentColor).toBe('#123456');
  });

  it.each(['layout', 'profile'] as const)('reparses retained combos affected by a changed game %s', async change => {
    const nextGame: Game = change === 'layout' ? { ...game, buttonLayout: ['A'] } : { ...game, notationProfile: 'nrs', buttonLayout: ['1', '2', '3', '4'] };
    const notation = change === 'profile' ? '1 4 1 D B 2' : 'LP';
    await db.combos.update(combo.id, { notation, parsedNotation: [] });
    const write = vi.spyOn(db.combos, 'bulkPut');
    await importData(data({ games: [nextGame], characters: [], combos: [] }), format);
    expect((await db.combos.get(combo.id))?.parsedNotation).toEqual(parseComboNotation(notation, nextGame.buttonLayout, { profile: nextGame.notationProfile }));
    expect(write.mock.calls.flatMap(([rows]) => rows.map(row => row.id))).toEqual([combo.id]);
    expect((await db.combos.get('other-combo'))?.parsedNotation).toEqual(combo.parsedNotation);
  });

  it('reparses retained combos when an imported character moves to another game', async () => {
    const nextGame = { ...game, id: 'target', buttonLayout: ['A'] };
    const write = vi.spyOn(db.combos, 'bulkPut');
    await importData(data({ games: [nextGame], characters: [{ ...character, gameId: nextGame.id }] }), format);
    expect((await db.combos.get(combo.id))?.parsedNotation).toEqual(parseComboNotation('LP', ['A']));
    expect(write.mock.calls.flatMap(([rows]) => rows.map(row => row.id))).toEqual([combo.id]);
  });

  it('leaves retained combos untouched when only parent names change', async () => {
    const write = vi.spyOn(db.combos, 'bulkPut');
    await importData(data({ games: [{ ...game, name: 'Renamed' }], characters: [{ ...character, name: 'Renamed fighter' }] }), format);
    expect(write.mock.calls.flatMap(([rows]) => rows.map(row => row.id))).toEqual([]);
  });

  it('rolls all imported tables back if affected retained combos cannot be written', async () => {
    const write = vi.spyOn(db.combos, 'bulkPut');
    write.mockRejectedValueOnce(new Error('retained write failed'));
    await expect(importData(data({ games: [{ ...game, buttonLayout: ['A'], name: 'Changed' }], settings: { ...DEFAULT_SETTINGS, colorTheme: 'dark' }, demoVideos: [{ id: 'imported-video', fileName: 'demo.mp4', mimeType: 'video/mp4', dataBase64: 'AQID' }] }), format, true)).rejects.toThrow('retained write failed');
    expect(await db.games.get(game.id)).toEqual(game);
    expect(await db.characters.get(character.id)).toEqual(character);
    expect(await db.combos.get(combo.id)).toEqual(combo);
    expect(await db.demoVideos.count()).toBe(0);
    expect((await db.settings.get(1))?.colorTheme).toBe('light');
  });

  it('rolls imported records and the full migration back when an old library marker cannot be saved', async () => {
    await db.settings.update(1, { parsedNotationVersion: 0 });
    await db.combos.update(combo.id, { parsedNotation: [] });
    vi.spyOn(db.settings, 'put').mockRejectedValueOnce(new Error('marker write failed'));
    const imported = { ...combo, id: 'imported', parsedNotation: [] };
    await expect(importData(data({ games: [{ ...game, name: 'Changed' }], combos: [imported], demoVideos: [{ id: 'imported-video', fileName: 'demo.mp4', mimeType: 'video/mp4', dataBase64: 'AQID' }] }), format)).rejects.toThrow('marker write failed');
    expect(await db.games.get(game.id)).toEqual(game);
    expect(await db.combos.get('imported')).toBeUndefined();
    expect((await db.combos.get(combo.id))?.parsedNotation).toEqual([]);
    expect(await db.demoVideos.count()).toBe(0);
    expect((await db.settings.get(1))?.parsedNotationVersion).toBe(0);
    await importData(data({ combos: [imported] }), format);
    expect((await db.combos.get(combo.id))?.parsedNotation).toEqual(combo.parsedNotation);
    expect((await db.combos.get('imported'))?.parsedNotation).toEqual(combo.parsedNotation);
    expect((await db.settings.get(1))?.parsedNotationVersion).toBe(COMBO_NOTATION_PARSER_VERSION);
  });
});
