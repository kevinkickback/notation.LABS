// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeApplication } from '@/lib/application/initializeApplication';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { COMBO_NOTATION_PARSER_VERSION, parseComboNotation } from '@/lib/parser';
import { db, indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { ensureCurrentNotation } from '@/lib/storage/notationMaintenance';

describe('atomic notation maintenance', () => {
  beforeEach(async () => {
    await db.transaction('rw', [db.games, db.characters, db.combos, db.settings, db.demoVideos], async () => {
      await Promise.all([db.games.clear(), db.characters.clear(), db.combos.clear(), db.settings.clear(), db.demoVideos.clear()]);
    });
  });
  afterEach(() => vi.restoreAllMocks());

  async function seed(version = 0) {
    const gameId = await indexedDbStorage.games.add({ name: 'Migration', buttonLayout: ['LP'] });
    const characterId = await indexedDbStorage.characters.add({ gameId, name: 'Fighter' });
    const comboId = await indexedDbStorage.combos.add({ characterId, name: 'Stored', notation: 'LP', tags: [], parsedNotation: [] });
    await db.settings.put({ id: 1, ...DEFAULT_SETTINGS, colorTheme: 'light', parsedNotationVersion: version });
    return comboId;
  }

  it('initializes preferences without rewriting combos or claiming parser maintenance', async () => {
    const comboId = await seed();
    const write = vi.spyOn(db.combos, 'bulkPut');
    await indexedDbStorage.settings.init();
    expect(write).not.toHaveBeenCalled();
    expect((await db.combos.get(comboId))?.parsedNotation).toEqual([]);
    expect((await db.settings.get(1))?.parsedNotationVersion).toBe(0);
  });

  it('rolls tokens back when writing the maintenance marker fails and permits retry', async () => {
    const comboId = await seed();
    const start = vi.fn();
    const end = vi.fn();
    vi.spyOn(db.settings, 'put').mockRejectedValueOnce(new Error('marker write failed'));
    await expect(initializeApplication({ onReparseStart: start, onReparseEnd: end })).rejects.toThrow('marker write failed');
    expect((await db.combos.get(comboId))?.parsedNotation).toEqual([]);
    expect((await db.settings.get(1))?.parsedNotationVersion).toBe(0);
    expect(start).toHaveBeenCalledOnce();
    expect(end).toHaveBeenCalledOnce();
    await initializeApplication();
    expect((await db.combos.get(comboId))?.parsedNotation).toEqual(parseComboNotation('LP', ['LP']));
    expect((await db.settings.get(1))?.parsedNotationVersion).toBe(COMBO_NOTATION_PARSER_VERSION);
    expect((await db.settings.get(1))?.colorTheme).toBe('light');
  });

  it('keeps the marker unchanged when a combo write fails', async () => {
    await seed();
    vi.spyOn(db.combos, 'bulkPut').mockRejectedValueOnce(new Error('combo write failed'));
    await expect(ensureCurrentNotation()).rejects.toThrow('combo write failed');
    expect((await db.settings.get(1))?.parsedNotationVersion).toBe(0);
  });

  it('serializes concurrent startup maintenance and does not reparse an up-to-date library', async () => {
    await seed();
    const write = vi.spyOn(db.combos, 'bulkPut');
    const firstStart = vi.fn();
    const secondStart = vi.fn();
    await Promise.all([initializeApplication({ onReparseStart: firstStart }), initializeApplication({ onReparseStart: secondStart })]);
    expect(write).toHaveBeenCalledOnce();
    expect(firstStart.mock.calls.length + secondStart.mock.calls.length).toBe(1);
    await initializeApplication();
    expect(write).toHaveBeenCalledOnce();
  });

  it('refreshes future parser versions safely when opening data with an older app', async () => {
    const comboId = await seed(COMBO_NOTATION_PARSER_VERSION + 1);
    await initializeApplication();
    expect((await db.combos.get(comboId))?.parsedNotation).toEqual(parseComboNotation('LP', ['LP']));
    expect((await db.settings.get(1))?.parsedNotationVersion).toBe(COMBO_NOTATION_PARSER_VERSION);
  });
});
