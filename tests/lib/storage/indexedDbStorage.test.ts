import 'fake-indexeddb/auto';
import JSZip from 'jszip';
import { describe, it, expect, beforeEach } from 'vitest';
import { indexedDbStorage, db } from '@/lib/storage/indexedDbStorage';
import { DEFAULT_SETTINGS } from '@/lib/defaults';

beforeEach(async () => {
  await db.games.clear();
  await db.characters.clear();
  await db.combos.clear();
  await db.settings.clear();
  await db.demoVideos.clear();
});

function assertDefined<T>(
  value: T | undefined | null,
): asserts value is NonNullable<T> {
  if (value === undefined || value === null) {
    throw new Error(`Expected value to be defined, but got ${value}`);
  }
}

describe('indexedDbStorage.games', () => {
  const gameData = {
    name: 'Street Fighter 6',
    buttonLayout: ['LP', 'MP', 'HP', 'LK', 'MK', 'HK'],
  };

  it('adds a game and returns an id', async () => {
    const id = await indexedDbStorage.games.add(gameData);
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('retrieves a game by id', async () => {
    const id = await indexedDbStorage.games.add(gameData);
    const game = await indexedDbStorage.games.get(id);
    assertDefined(game);
    expect(game.name).toBe('Street Fighter 6');
    expect(game.buttonLayout).toEqual(['LP', 'MP', 'HP', 'LK', 'MK', 'HK']);
    expect(game.id).toBe(id);
  });

  it('sets createdAt and updatedAt timestamps on add', async () => {
    const before = Date.now();
    const id = await indexedDbStorage.games.add(gameData);
    const after = Date.now();
    const game = await indexedDbStorage.games.get(id);
    assertDefined(game);
    expect(game.createdAt).toBeGreaterThanOrEqual(before);
    expect(game.createdAt).toBeLessThanOrEqual(after);
    expect(game.updatedAt).toBeGreaterThanOrEqual(before);
    expect(game.updatedAt).toBeLessThanOrEqual(after);
  });

  it('returns all games', async () => {
    await indexedDbStorage.games.add(gameData);
    await indexedDbStorage.games.add({
      name: 'Guilty Gear Strive',
      buttonLayout: ['P', 'K', 'S', 'H', 'D'],
    });
    const all = await indexedDbStorage.games.getAll();
    expect(all).toHaveLength(2);
  });

  it('updates a game', async () => {
    const id = await indexedDbStorage.games.add(gameData);
    await indexedDbStorage.games.update(id, { name: 'SF6' });
    const updated = await indexedDbStorage.games.get(id);
    assertDefined(updated);
    expect(updated.name).toBe('SF6');
    expect(updated.buttonLayout).toEqual(['LP', 'MP', 'HP', 'LK', 'MK', 'HK']);
  });

  it('updates updatedAt timestamp on update', async () => {
    const id = await indexedDbStorage.games.add(gameData);
    const game = await indexedDbStorage.games.get(id);
    assertDefined(game);
    const originalUpdatedAt = game.updatedAt;

    // Small delay to ensure timestamp difference
    await new Promise((r) => setTimeout(r, 10));
    await indexedDbStorage.games.update(id, { name: 'SF6' });

    const updated = await indexedDbStorage.games.get(id);
    assertDefined(updated);
    expect(updated.updatedAt).toBeGreaterThan(originalUpdatedAt);
    expect(updated.createdAt).toBe(game.createdAt);
  });

  it('deletes a game', async () => {
    const id = await indexedDbStorage.games.add(gameData);
    await indexedDbStorage.games.delete(id);
    const game = await indexedDbStorage.games.get(id);
    expect(game).toBeUndefined();
  });

  it('cascading delete removes characters when game is deleted', async () => {
    const gameId = await indexedDbStorage.games.add(gameData);
    await indexedDbStorage.characters.add({ gameId, name: 'Ryu' });
    await indexedDbStorage.characters.add({ gameId, name: 'Ken' });

    await indexedDbStorage.games.delete(gameId);
    const chars = await indexedDbStorage.characters.getByGame(gameId);
    expect(chars).toHaveLength(0);
  });

  it('cascading delete removes combos when game is deleted', async () => {
    const gameId = await indexedDbStorage.games.add(gameData);
    const charId = await indexedDbStorage.characters.add({
      gameId,
      name: 'Ryu',
    });
    await indexedDbStorage.combos.add({
      characterId: charId,
      name: 'BnB',
      notation: '236P',
      parsedNotation: [],
      tags: [],
    });

    await indexedDbStorage.games.delete(gameId);
    const combos = await indexedDbStorage.combos.getByCharacter(charId);
    expect(combos).toHaveLength(0);
  });

  it('cascading delete removes local demo videos when game is deleted', async () => {
    const gameId = await indexedDbStorage.games.add(gameData);
    const charId = await indexedDbStorage.characters.add({
      gameId,
      name: 'Ryu',
    });
    await indexedDbStorage.demoVideos.add({
      id: 'game-video',
      data: new Uint8Array([1, 2, 3]).buffer,
      mimeType: 'video/mp4',
      fileName: 'game.mp4',
    });
    await indexedDbStorage.combos.add({
      characterId: charId,
      name: 'Video Combo',
      notation: '236P',
      parsedNotation: [],
      tags: [],
      demoUrl: 'local:game-video',
      demoFileName: 'game.mp4',
    });

    await indexedDbStorage.games.delete(gameId);

    await expect(
      indexedDbStorage.demoVideos.get('game-video'),
    ).resolves.toBeUndefined();
  });

  it('returns undefined for non-existent game', async () => {
    const game = await indexedDbStorage.games.get('non-existent');
    expect(game).toBeUndefined();
  });
});

describe('indexedDbStorage.characters', () => {
  let gameId: string;

  beforeEach(async () => {
    gameId = await indexedDbStorage.games.add({
      name: 'Test Game',
      buttonLayout: ['A', 'B', 'C'],
    });
  });

  it('adds a character and returns an id', async () => {
    const id = await indexedDbStorage.characters.add({
      gameId,
      name: 'Fighter',
    });
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
  });

  it('retrieves a character by id', async () => {
    const id = await indexedDbStorage.characters.add({
      gameId,
      name: 'Fighter',
    });
    const char = await indexedDbStorage.characters.get(id);
    assertDefined(char);
    expect(char.name).toBe('Fighter');
    expect(char.gameId).toBe(gameId);
  });

  it('retrieves characters by game', async () => {
    await indexedDbStorage.characters.add({ gameId, name: 'Fighter A' });
    await indexedDbStorage.characters.add({ gameId, name: 'Fighter B' });
    const otherGameId = await indexedDbStorage.games.add({
      name: 'Other',
      buttonLayout: [],
    });
    await indexedDbStorage.characters.add({
      gameId: otherGameId,
      name: 'Other Fighter',
    });

    const chars = await indexedDbStorage.characters.getByGame(gameId);
    expect(chars).toHaveLength(2);
    expect(chars.every((c: { gameId: string }) => c.gameId === gameId)).toBe(
      true,
    );
  });

  it('returns all characters', async () => {
    await indexedDbStorage.characters.add({ gameId, name: 'A' });
    await indexedDbStorage.characters.add({ gameId, name: 'B' });
    const all = await indexedDbStorage.characters.getAll();
    expect(all).toHaveLength(2);
  });

  it('updates a character', async () => {
    const id = await indexedDbStorage.characters.add({
      gameId,
      name: 'Old Name',
    });
    await indexedDbStorage.characters.update(id, { name: 'New Name' });
    const updated = await indexedDbStorage.characters.get(id);
    assertDefined(updated);
    expect(updated.name).toBe('New Name');
  });

  it('deletes a character', async () => {
    const id = await indexedDbStorage.characters.add({
      gameId,
      name: 'Fighter',
    });
    await indexedDbStorage.characters.delete(id);
    const char = await indexedDbStorage.characters.get(id);
    expect(char).toBeUndefined();
  });

  it('cascading delete removes combos when character is deleted', async () => {
    const charId = await indexedDbStorage.characters.add({
      gameId,
      name: 'Fighter',
    });
    await indexedDbStorage.combos.add({
      characterId: charId,
      name: 'Combo 1',
      notation: 'A > B',
      parsedNotation: [],
      tags: [],
    });
    await indexedDbStorage.combos.add({
      characterId: charId,
      name: 'Combo 2',
      notation: 'B > C',
      parsedNotation: [],
      tags: [],
    });

    await indexedDbStorage.characters.delete(charId);
    const combos = await indexedDbStorage.combos.getByCharacter(charId);
    expect(combos).toHaveLength(0);
  });

  it('cascading delete removes local demo videos when character is deleted', async () => {
    const charId = await indexedDbStorage.characters.add({
      gameId,
      name: 'Fighter',
    });
    await indexedDbStorage.demoVideos.add({
      id: 'character-video',
      data: new Uint8Array([4, 5, 6]).buffer,
      mimeType: 'video/mp4',
      fileName: 'character.mp4',
    });
    await indexedDbStorage.combos.add({
      characterId: charId,
      name: 'Video Combo',
      notation: 'A > B',
      parsedNotation: [],
      tags: [],
      demoUrl: 'local:character-video',
      demoFileName: 'character.mp4',
    });

    await indexedDbStorage.characters.delete(charId);

    await expect(
      indexedDbStorage.demoVideos.get('character-video'),
    ).resolves.toBeUndefined();
  });
});

describe('indexedDbStorage.combos', () => {
  let gameId: string;
  let charId: string;

  beforeEach(async () => {
    gameId = await indexedDbStorage.games.add({
      name: 'Test Game',
      buttonLayout: ['A', 'B', 'C'],
    });
    charId = await indexedDbStorage.characters.add({ gameId, name: 'Fighter' });
  });

  const comboData = () => ({
    characterId: charId,
    name: 'BnB Combo',
    notation: '236P > 214K',
    parsedNotation: [],
    tags: ['bnb', 'easy'],
  });

  it('adds a combo and returns an id', async () => {
    const id = await indexedDbStorage.combos.add(comboData());
    expect(id).toBeDefined();
  });

  it('retrieves a combo by id', async () => {
    const id = await indexedDbStorage.combos.add(comboData());
    const combo = await indexedDbStorage.combos.get(id);
    assertDefined(combo);
    expect(combo.name).toBe('BnB Combo');
    expect(combo.characterId).toBe(charId);
    expect(combo.tags).toEqual(['bnb', 'easy']);
  });

  it('auto-assigns sortOrder as max+1 per character', async () => {
    const id1 = await indexedDbStorage.combos.add(comboData());
    const id2 = await indexedDbStorage.combos.add({
      ...comboData(),
      name: 'Combo 2',
    });
    const id3 = await indexedDbStorage.combos.add({
      ...comboData(),
      name: 'Combo 3',
    });

    const c1 = await indexedDbStorage.combos.get(id1);
    const c2 = await indexedDbStorage.combos.get(id2);
    const c3 = await indexedDbStorage.combos.get(id3);
    assertDefined(c1);
    assertDefined(c2);
    assertDefined(c3);
    expect(c1.sortOrder).toBe(0);
    expect(c2.sortOrder).toBe(1);
    expect(c3.sortOrder).toBe(2);
  });

  it('continues sortOrder from highest existing value', async () => {
    const firstId = await indexedDbStorage.combos.add(comboData());
    const secondId = await indexedDbStorage.combos.add({
      ...comboData(),
      name: 'Combo 2',
    });

    await indexedDbStorage.combos.update(firstId, { sortOrder: 10 });
    await indexedDbStorage.combos.update(secondId, { sortOrder: 2 });

    const thirdId = await indexedDbStorage.combos.add({
      ...comboData(),
      name: 'Combo 3',
    });

    const third = await indexedDbStorage.combos.get(thirdId);
    assertDefined(third);
    expect(third.sortOrder).toBe(11);
  });

  it('retrieves combos by character sorted by sortOrder', async () => {
    await indexedDbStorage.combos.add({ ...comboData(), name: 'C' });
    await indexedDbStorage.combos.add({ ...comboData(), name: 'A' });
    await indexedDbStorage.combos.add({ ...comboData(), name: 'B' });

    const combos = await indexedDbStorage.combos.getByCharacter(charId);
    expect(combos).toHaveLength(3);
    expect(combos[0].name).toBe('C');
    expect(combos[1].name).toBe('A');
    expect(combos[2].name).toBe('B');
  });

  it('updates a combo', async () => {
    const id = await indexedDbStorage.combos.add(comboData());
    await indexedDbStorage.combos.update(id, {
      name: 'Updated Combo',
      damage: '3500',
    });
    const updated = await indexedDbStorage.combos.get(id);
    assertDefined(updated);
    expect(updated.name).toBe('Updated Combo');
    expect(updated.damage).toBe('3500');
  });

  it('deletes a combo', async () => {
    const id = await indexedDbStorage.combos.add(comboData());
    await indexedDbStorage.combos.delete(id);
    const combo = await indexedDbStorage.combos.get(id);
    expect(combo).toBeUndefined();
  });

  it('reorders combos', async () => {
    const id1 = await indexedDbStorage.combos.add({
      ...comboData(),
      name: 'First',
    });
    const id2 = await indexedDbStorage.combos.add({
      ...comboData(),
      name: 'Second',
    });
    const id3 = await indexedDbStorage.combos.add({
      ...comboData(),
      name: 'Third',
    });

    await indexedDbStorage.combos.reorder([id3, id1, id2]);

    const c1 = await indexedDbStorage.combos.get(id1);
    const c2 = await indexedDbStorage.combos.get(id2);
    const c3 = await indexedDbStorage.combos.get(id3);
    assertDefined(c1);
    assertDefined(c2);
    assertDefined(c3);
    expect(c3.sortOrder).toBe(0);
    expect(c1.sortOrder).toBe(1);
    expect(c2.sortOrder).toBe(2);
  });

  it('returns all combos', async () => {
    await indexedDbStorage.combos.add(comboData());
    await indexedDbStorage.combos.add({ ...comboData(), name: 'Another' });
    const all = await indexedDbStorage.combos.getAll();
    expect(all).toHaveLength(2);
  });

  describe('search', () => {
    beforeEach(async () => {
      await indexedDbStorage.combos.add({
        ...comboData(),
        name: 'Hadouken Combo',
        notation: '236P',
        description: 'Basic fireball combo',
        tags: ['fireball', 'easy'],
      });
      await indexedDbStorage.combos.add({
        ...comboData(),
        name: 'Shoryuken Punish',
        notation: '623HP',
        description: 'Anti-air punish',
        tags: ['anti-air', 'advanced'],
      });
      await indexedDbStorage.combos.add({
        ...comboData(),
        name: 'Throw Loop',
        notation: '6LP+LK',
        description: 'Command grab setup',
        tags: ['grab', 'loop'],
      });
    });

    it('searches by combo name', async () => {
      const results = await indexedDbStorage.combos.search('hadouken');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Hadouken Combo');
    });

    it('searches by notation', async () => {
      const results = await indexedDbStorage.combos.search('623');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Shoryuken Punish');
    });

    it('searches by description', async () => {
      const results = await indexedDbStorage.combos.search('basic');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Hadouken Combo');
    });

    it('searches by tags', async () => {
      const results = await indexedDbStorage.combos.search('loop');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Throw Loop');
    });

    it('search is case-insensitive', async () => {
      const results = await indexedDbStorage.combos.search('HADOUKEN');
      expect(results).toHaveLength(1);
    });

    it('returns empty array for no matches', async () => {
      const results = await indexedDbStorage.combos.search('nonexistent');
      expect(results).toHaveLength(0);
    });

    it('returns multiple matches', async () => {
      const results = await indexedDbStorage.combos.search('6');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('indexedDbStorage.settings', () => {
  it('returns default settings when none exist', async () => {
    const settings = await indexedDbStorage.settings.get();
    expect(settings.colorTheme).toBe('dark');
    expect(settings.fontFamily).toBe('system-ui');
    expect(settings.displayMode).toBe('colored-text');
    expect(settings.iconStyle).toBe('round');
    expect(settings.comboScale).toBe(1);
    expect(settings.autoUpdate).toBe(true);
    expect(settings.confirmBeforeDelete).toBe(true);
    expect(settings.videoPlayerSize).toBe('lg');
    expect(settings.gameCardSize).toBe(180);
    expect(settings.characterCardSize).toBe(180);
    expect(settings.showChangelogBeforeUpdate).toBe(true);
  });

  it('auto-initializes settings in DB on first get', async () => {
    await indexedDbStorage.settings.init();
    const raw = await db.settings.get(1);
    assertDefined(raw);
    expect(raw.id).toBe(1);
  });

  it('does not include id property in returned settings', async () => {
    await indexedDbStorage.settings.init();
    // get() reads the existing row after init
    const settings = await indexedDbStorage.settings.get();
    expect(settings).not.toHaveProperty('id');
  });

  it('updates settings', async () => {
    await indexedDbStorage.settings.update({
      comboScale: 1.5,
      displayMode: 'visual-icons',
    });
    const settings = await indexedDbStorage.settings.get();
    expect(settings.comboScale).toBe(1.5);
    expect(settings.displayMode).toBe('visual-icons');
  });

  it('preserves other settings on partial update', async () => {
    await indexedDbStorage.settings.update({ comboScale: 2 });
    const settings = await indexedDbStorage.settings.get();
    expect(settings.comboScale).toBe(2);
    expect(settings.fontFamily).toBe('system-ui');
    expect(settings.colorTheme).toBe('dark');
  });

  it('initializes and applies updates when no settings exist', async () => {
    // Settings table is clear, update should create with defaults + updates
    await indexedDbStorage.settings.update({ fontFamily: 'jetbrains-mono' });
    const settings = await indexedDbStorage.settings.get();
    expect(settings.fontFamily).toBe('jetbrains-mono');
    expect(settings.colorTheme).toBe('dark'); // default preserved
  });

  it('migrates legacy oklch notation colors during init', async () => {
    await db.settings.put({
      id: 1,
      ...DEFAULT_SETTINGS,
      notationColors: {
        ...DEFAULT_SETTINGS.notationColors,
        direction: 'oklch(0.85 0.05 265)',
        separator: 'oklch(0.55 0.02 265)',
      },
    });

    await indexedDbStorage.settings.init();

    const settings = await indexedDbStorage.settings.get();
    expect(settings.notationColors.direction).toBe('#bdceef');
    expect(settings.notationColors.separator).toBe('#6c727e');
  });
});

describe('indexedDbStorage.demoVideos', () => {
  const videoData = {
    id: 'video-1',
    data: new Uint8Array([1, 2, 3, 4, 5]).buffer,
    mimeType: 'video/mp4',
    fileName: 'demo.mp4',
  };

  it('adds and retrieves a demo video', async () => {
    await indexedDbStorage.demoVideos.add(videoData);
    const video = await indexedDbStorage.demoVideos.get('video-1');
    assertDefined(video);
    expect(video.mimeType).toBe('video/mp4');
    expect(video.fileName).toBe('demo.mp4');
  });

  it('deletes a demo video', async () => {
    await indexedDbStorage.demoVideos.add(videoData);
    await indexedDbStorage.demoVideos.delete('video-1');
    const video = await indexedDbStorage.demoVideos.get('video-1');
    expect(video).toBeUndefined();
  });

  it('returns all demo videos', async () => {
    await indexedDbStorage.demoVideos.add(videoData);
    await indexedDbStorage.demoVideos.add({
      ...videoData,
      id: 'video-2',
      fileName: 'demo2.mp4',
    });
    const all = await indexedDbStorage.demoVideos.getAll();
    expect(all).toHaveLength(2);
  });

  it('returns null for non-existent video blob URL', async () => {
    const url = await indexedDbStorage.demoVideos.getBlobUrl('non-existent');
    expect(url).toBeNull();
  });

  it('returns a blob URL for existing video', async () => {
    await indexedDbStorage.demoVideos.add(videoData);
    const url = await indexedDbStorage.demoVideos.getBlobUrl('video-1');
    assertDefined(url);
    expect(typeof url).toBe('string');
    expect(url.startsWith('blob:')).toBe(true);
  });
});

describe('indexedDbStorage.export', () => {
  it('exports all data as JSON string', async () => {
    const gameId = await indexedDbStorage.games.add({
      name: 'Test Game',
      buttonLayout: ['A', 'B'],
    });
    const charId = await indexedDbStorage.characters.add({
      gameId,
      name: 'Hero',
    });
    await indexedDbStorage.combos.add({
      characterId: charId,
      name: 'Combo',
      notation: 'A > B',
      parsedNotation: [],
      tags: ['test'],
    });

    const blob = await indexedDbStorage.export();
    const parsed = JSON.parse(await blob.text());
    expect(parsed.version).toBe(1);
    expect(parsed.exported).toBeDefined();
    expect(parsed.games).toHaveLength(1);
    expect(parsed.characters).toHaveLength(1);
    expect(parsed.combos).toHaveLength(1);
  });

  it('exports with filter by gameIds', async () => {
    const g1 = await indexedDbStorage.games.add({
      name: 'Game 1',
      buttonLayout: [],
    });
    await indexedDbStorage.games.add({ name: 'Game 2', buttonLayout: [] });

    const blob = await indexedDbStorage.export(false, { gameIds: [g1] });
    const parsed = JSON.parse(await blob.text());
    expect(parsed.games).toHaveLength(1);
    expect(parsed.games[0].name).toBe('Game 1');
  });

  it('exports with filter by characterIds', async () => {
    const gameId = await indexedDbStorage.games.add({
      name: 'Game',
      buttonLayout: [],
    });
    const c1 = await indexedDbStorage.characters.add({
      gameId,
      name: 'Char 1',
    });
    await indexedDbStorage.characters.add({ gameId, name: 'Char 2' });

    const blob = await indexedDbStorage.export(false, { characterIds: [c1] });
    const parsed = JSON.parse(await blob.text());
    expect(parsed.characters).toHaveLength(1);
    expect(parsed.characters[0].name).toBe('Char 1');
  });

  it('exports with filter by comboIds', async () => {
    const gameId = await indexedDbStorage.games.add({
      name: 'Game',
      buttonLayout: [],
    });
    const charId = await indexedDbStorage.characters.add({
      gameId,
      name: 'Char',
    });
    const combo1 = await indexedDbStorage.combos.add({
      characterId: charId,
      name: 'Keep',
      notation: 'A',
      parsedNotation: [],
      tags: [],
    });
    await indexedDbStorage.combos.add({
      characterId: charId,
      name: 'Skip',
      notation: 'B',
      parsedNotation: [],
      tags: [],
    });

    const blob = await indexedDbStorage.export(false, { comboIds: [combo1] });
    const parsed = JSON.parse(await blob.text());
    expect(parsed.combos).toHaveLength(1);
    expect(parsed.combos[0].name).toBe('Keep');
  });

  it('exports with videos when includeVideos is true', async () => {
    const gameId = await indexedDbStorage.games.add({
      name: 'Game',
      buttonLayout: [],
    });
    const charId = await indexedDbStorage.characters.add({
      gameId,
      name: 'Char',
    });
    const videoId = 'vid-1';
    await indexedDbStorage.demoVideos.add({
      id: videoId,
      data: new Uint8Array([10, 20, 30]).buffer,
      mimeType: 'video/mp4',
      fileName: 'test.mp4',
    });
    await indexedDbStorage.combos.add({
      characterId: charId,
      name: 'Combo',
      notation: 'A',
      parsedNotation: [],
      tags: [],
      demoUrl: `local:${videoId}`,
    });

    const blob = await indexedDbStorage.export(true);
    expect(blob.type).toBe('application/zip');

    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const backupEntry = zip.file('backup.json');
    expect(backupEntry).toBeTruthy();
    const parsed = JSON.parse(await backupEntry!.async('string'));

    expect(parsed.version).toBe(3);
    expect(parsed.demoVideos).toBeDefined();
    expect(parsed.demoVideos).toHaveLength(1);
    expect(parsed.demoVideos[0].path).toBeTruthy();
    expect(parsed.demoVideos[0].mimeType).toBe('video/mp4');

    const videoEntry = zip.file(parsed.demoVideos[0].path);
    expect(videoEntry).toBeTruthy();
  });

  it('invokes onProgress callback once per video during export', async () => {
    const gameId = await indexedDbStorage.games.add({
      name: 'Game',
      buttonLayout: [],
    });
    const charId = await indexedDbStorage.characters.add({
      gameId,
      name: 'Char',
    });
    for (let i = 0; i < 3; i++) {
      await indexedDbStorage.demoVideos.add({
        id: `prog-vid-${i}`,
        data: new Uint8Array([i]).buffer,
        mimeType: 'video/mp4',
        fileName: `v${i}.mp4`,
      });
      await indexedDbStorage.combos.add({
        characterId: charId,
        name: `Combo ${i}`,
        notation: 'A',
        parsedNotation: [],
        tags: [],
        demoUrl: `local:prog-vid-${i}`,
      });
    }

    const calls: [number, number][] = [];
    await indexedDbStorage.export(true, undefined, (current, total) => {
      calls.push([current, total]);
    });

    // onProgress(0, 3) then (1,3), (2,3), (3,3)
    expect(calls).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('sanitizes local demo references when videos are excluded from export', async () => {
    const gameId = await indexedDbStorage.games.add({
      name: 'Game',
      buttonLayout: [],
    });
    const charId = await indexedDbStorage.characters.add({
      gameId,
      name: 'Char',
    });
    await indexedDbStorage.demoVideos.add({
      id: 'export-video',
      data: new Uint8Array([7, 8, 9]).buffer,
      mimeType: 'video/mp4',
      fileName: 'export.mp4',
    });
    await indexedDbStorage.combos.add({
      characterId: charId,
      name: 'Local Demo Combo',
      notation: 'A',
      parsedNotation: [],
      tags: [],
      demoUrl: 'local:export-video',
      demoFileName: 'export.mp4',
      demoVideoTitle: 'Export demo',
    });

    const blob = await indexedDbStorage.export(false);
    const parsed = JSON.parse(await blob.text());

    expect(parsed.version).toBe(1);
    expect(parsed.combos).toHaveLength(1);
    expect(parsed.combos[0].demoUrl).toBeUndefined();
    expect(parsed.combos[0].demoFileName).toBeUndefined();
    expect(parsed.combos[0].demoVideoTitle).toBeUndefined();
  });
});

describe('indexedDbStorage.import', () => {
  it('imports games, characters, and combos', async () => {
    const data = JSON.stringify({
      version: 1,
      exported: new Date().toISOString(),
      games: [
        {
          id: 'g1',
          name: 'Imported Game',
          buttonLayout: ['X'],
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      characters: [
        {
          id: 'c1',
          gameId: 'g1',
          name: 'Imported Char',
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      combos: [
        {
          id: 'combo1',
          characterId: 'c1',
          name: 'Imported Combo',
          notation: 'X',
          parsedNotation: [],
          tags: [],
          sortOrder: 0,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });

    await indexedDbStorage.import(data);
    const games = await indexedDbStorage.games.getAll();
    const chars = await indexedDbStorage.characters.getAll();
    const combos = await indexedDbStorage.combos.getAll();
    expect(games).toHaveLength(1);
    expect(games[0].name).toBe('Imported Game');
    expect(chars).toHaveLength(1);
    expect(combos).toHaveLength(1);
  });

  it('imports settings', async () => {
    const data = JSON.stringify({
      version: 1,
      exported: new Date().toISOString(),
      settings: {
        colorTheme: 'dark',
        fontFamily: 'system-ui',
        notationColors: { direction: '#fff', separator: '#ccc' },
        displayMode: 'visual-icons',
        iconStyle: 'round',
        uiTheme: 'default',
        comboScale: 2.5,
        autoUpdate: true,
        confirmBeforeDelete: true,
        videoPlayerSize: 'lg',
        gameCardSize: 180,
        characterCardSize: 180,
        showChangelogBeforeUpdate: true,
      },
    });

    await indexedDbStorage.import(data, false, true);
    const raw = await db.settings.get(1);
    assertDefined(raw);
    expect(raw.comboScale).toBe(2.5);
    expect(raw.displayMode).toBe('visual-icons');
  });

  it('does not import settings unless includeSettings is true', async () => {
    await indexedDbStorage.settings.update({
      colorTheme: 'light',
      comboScale: 1,
    });

    const data = JSON.stringify({
      version: 1,
      exported: new Date().toISOString(),
      settings: {
        colorTheme: 'dark',
        fontFamily: 'system-ui',
        notationColors: { direction: '#fff', separator: '#ccc' },
        displayMode: 'visual-icons',
        iconStyle: 'round',
        uiTheme: 'default',
        comboScale: 2.5,
        autoUpdate: true,
        confirmBeforeDelete: true,
        videoPlayerSize: 'lg',
        gameCardSize: 180,
        characterCardSize: 180,
        showChangelogBeforeUpdate: true,
      },
    });

    await indexedDbStorage.import(data, false, false);
    const settings = await indexedDbStorage.settings.get();
    expect(settings.colorTheme).toBe('light');
    expect(settings.comboScale).toBe(1);
  });

  it('marks parser version stale when importing combos without settings', async () => {
    await indexedDbStorage.settings.update({
      parsedNotationVersion: 999,
      colorTheme: 'light',
    });

    const data = JSON.stringify({
      version: 1,
      exported: new Date().toISOString(),
      games: [
        {
          id: 'g1',
          name: 'Imported Game',
          buttonLayout: ['A'],
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      characters: [
        {
          id: 'c1',
          gameId: 'g1',
          name: 'Imported Char',
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      combos: [
        {
          id: 'combo1',
          characterId: 'c1',
          name: 'Imported Combo',
          notation: 'A',
          parsedNotation: [],
          tags: [],
          sortOrder: 0,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });

    await indexedDbStorage.import(data, false, false);

    const settings = await indexedDbStorage.settings.get();
    expect(settings.parsedNotationVersion).toBe(0);
    expect(settings.colorTheme).toBe('light');
  });

  it('imports demo videos when includeVideos is true', async () => {
    // Base64 of [10, 20, 30]
    const base64Data = btoa(String.fromCharCode(10, 20, 30));
    const data = JSON.stringify({
      version: 2,
      exported: new Date().toISOString(),
      demoVideos: [
        {
          id: 'v1',
          fileName: 'test.mp4',
          mimeType: 'video/mp4',
          dataBase64: base64Data,
        },
      ],
    });

    await indexedDbStorage.import(data, true);
    const video = await indexedDbStorage.demoVideos.get('v1');
    assertDefined(video);
    expect(video.mimeType).toBe('video/mp4');
    expect(new Uint8Array(video.data)).toEqual(new Uint8Array([10, 20, 30]));
  });

  it('skips videos when includeVideos is false', async () => {
    const data = JSON.stringify({
      version: 2,
      exported: new Date().toISOString(),
      demoVideos: [
        {
          id: 'v1',
          fileName: 'test.mp4',
          mimeType: 'video/mp4',
          dataBase64: btoa('test'),
        },
      ],
    });

    await indexedDbStorage.import(data, false);
    const video = await indexedDbStorage.demoVideos.get('v1');
    expect(video).toBeUndefined();
  });

  it('sanitizes local demo references when referenced videos are not imported', async () => {
    const data = JSON.stringify({
      version: 2,
      exported: new Date().toISOString(),
      games: [
        {
          id: 'g1',
          name: 'Imported Game',
          buttonLayout: ['A'],
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      characters: [
        {
          id: 'c1',
          gameId: 'g1',
          name: 'Imported Char',
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      combos: [
        {
          id: 'combo-local',
          characterId: 'c1',
          name: 'Imported Combo',
          notation: 'A',
          parsedNotation: [],
          tags: [],
          demoUrl: 'local:missing-video',
          demoFileName: 'missing.mp4',
          demoVideoTitle: 'Missing demo',
          sortOrder: 0,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });

    await indexedDbStorage.import(data, false);
    const combo = await indexedDbStorage.combos.get('combo-local');
    assertDefined(combo);
    expect(combo.demoUrl).toBeUndefined();
    expect(combo.demoFileName).toBeUndefined();
    expect(combo.demoVideoTitle).toBeUndefined();
  });

  it('merges imported data with existing data (put semantics)', async () => {
    await indexedDbStorage.games.add({
      name: 'Existing Game',
      buttonLayout: [],
    });

    const data = JSON.stringify({
      version: 1,
      exported: new Date().toISOString(),
      games: [
        {
          id: 'new-game',
          name: 'New Game',
          buttonLayout: ['A'],
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });

    await indexedDbStorage.import(data);
    const games = await indexedDbStorage.games.getAll();
    expect(games).toHaveLength(2);
  });

  it('round-trips exported data including settings and local demo videos', async () => {
    const gameId = await indexedDbStorage.games.add({
      name: 'Round Trip Game',
      buttonLayout: ['LP', 'MP'],
      buttonColors: { LP: '#112233', MP: '#445566' },
    });
    const characterId = await indexedDbStorage.characters.add({
      gameId,
      name: 'Round Trip Hero',
    });
    const videoBytes = new Uint8Array([0, 5, 10, 200, 255]);
    await indexedDbStorage.demoVideos.add({
      id: 'video-roundtrip',
      data: videoBytes.buffer.slice(0),
      mimeType: 'video/mp4',
      fileName: 'roundtrip.mp4',
    });
    await indexedDbStorage.combos.add({
      characterId,
      name: 'Round Trip Combo',
      notation: 'LP > MP',
      parsedNotation: [],
      tags: ['roundtrip'],
      demoUrl: 'local:video-roundtrip',
      demoFileName: 'roundtrip.mp4',
    });
    await indexedDbStorage.settings.update({
      fontFamily: 'jetbrains-mono',
      comboScale: 1.25,
      notationColors: {
        ...DEFAULT_SETTINGS.notationColors,
        direction: '#123456',
        separator: '#654321',
      },
    });

    const exportedBlob = await indexedDbStorage.export(true);

    await db.games.clear();
    await db.characters.clear();
    await db.combos.clear();
    await db.settings.clear();
    await db.demoVideos.clear();

    await indexedDbStorage.importZip(exportedBlob, true, true);

    const importedGames = await indexedDbStorage.games.getAll();
    const importedCharacters = await indexedDbStorage.characters.getAll();
    const importedCombos = await indexedDbStorage.combos.getAll();
    const importedSettings = await indexedDbStorage.settings.get();
    const importedVideo =
      await indexedDbStorage.demoVideos.get('video-roundtrip');

    expect(importedGames).toHaveLength(1);
    expect(importedCharacters).toHaveLength(1);
    expect(importedCombos).toHaveLength(1);
    expect(importedCombos[0].demoUrl).toBe('local:video-roundtrip');
    expect(importedSettings.fontFamily).toBe('jetbrains-mono');
    expect(importedSettings.comboScale).toBe(1.25);
    expect(importedSettings.notationColors.direction).toBe('#123456');
    assertDefined(importedVideo);
    expect(importedVideo.fileName).toBe('roundtrip.mp4');
    expect(Array.from(new Uint8Array(importedVideo.data))).toEqual(
      Array.from(videoBytes),
    );
  });

  it('marks parser version stale when importing zip combos without settings', async () => {
    await indexedDbStorage.settings.update({
      parsedNotationVersion: 999,
      colorTheme: 'light',
    });

    const gameId = await indexedDbStorage.games.add({
      name: 'Zip Import Game',
      buttonLayout: ['LP'],
    });
    const characterId = await indexedDbStorage.characters.add({
      gameId,
      name: 'Zip Import Hero',
    });
    await indexedDbStorage.combos.add({
      characterId,
      name: 'Zip Combo',
      notation: 'LP',
      parsedNotation: [],
      tags: [],
    });

    const exportedBlob = await indexedDbStorage.export(true);

    await db.games.clear();
    await db.characters.clear();
    await db.combos.clear();

    await indexedDbStorage.importZip(exportedBlob, true, false);

    const settings = await indexedDbStorage.settings.get();
    expect(settings.parsedNotationVersion).toBe(0);
    expect(settings.colorTheme).toBe('light');
  });

  it('reports progress while importing zip backups with videos', async () => {
    const gameId = await indexedDbStorage.games.add({
      name: 'Progress Game',
      buttonLayout: ['LP'],
    });
    const characterId = await indexedDbStorage.characters.add({
      gameId,
      name: 'Progress Hero',
    });

    await indexedDbStorage.demoVideos.add({
      id: 'video-one',
      data: new Uint8Array([1, 2, 3]).buffer,
      mimeType: 'video/mp4',
      fileName: 'one.mp4',
    });
    await indexedDbStorage.demoVideos.add({
      id: 'video-two',
      data: new Uint8Array([4, 5, 6]).buffer,
      mimeType: 'video/mp4',
      fileName: 'two.mp4',
    });
    await indexedDbStorage.combos.add({
      characterId,
      name: 'Combo One',
      notation: 'LP',
      parsedNotation: [],
      tags: [],
      demoUrl: 'local:video-one',
      demoFileName: 'one.mp4',
    });
    await indexedDbStorage.combos.add({
      characterId,
      name: 'Combo Two',
      notation: 'MP',
      parsedNotation: [],
      tags: [],
      demoUrl: 'local:video-two',
      demoFileName: 'two.mp4',
    });

    const exportedBlob = await indexedDbStorage.export(true);
    const progressEvents: Array<{
      phase: 'loading' | 'videos' | 'finalizing';
      current: number;
      total: number | null;
    }> = [];

    await db.games.clear();
    await db.characters.clear();
    await db.combos.clear();
    await db.settings.clear();
    await db.demoVideos.clear();

    await indexedDbStorage.importZip(exportedBlob, true, false, (progress) => {
      progressEvents.push(progress);
    });

    expect(progressEvents).toEqual(
      expect.arrayContaining([
        { phase: 'loading', current: 0, total: null },
        { phase: 'videos', current: 0, total: 2 },
        { phase: 'videos', current: 1, total: 2 },
        { phase: 'videos', current: 2, total: 2 },
        { phase: 'finalizing', current: 2, total: 2 },
      ]),
    );
  });

  it('rejects invalid import data before writing records', async () => {
    const invalidData = JSON.stringify({
      version: 2,
      exported: new Date().toISOString(),
      games: [{ id: 'g1', name: 'Broken' }],
    });

    await expect(indexedDbStorage.import(invalidData, true)).rejects.toThrow();
    await expect(indexedDbStorage.games.getAll()).resolves.toHaveLength(0);
    await expect(indexedDbStorage.characters.getAll()).resolves.toHaveLength(0);
    await expect(indexedDbStorage.combos.getAll()).resolves.toHaveLength(0);
  });

  it('imports backups with more than 100 videos', async () => {
    const demoVideos = Array.from({ length: 126 }, (_, idx) => ({
      id: `video-${idx}`,
      fileName: `video-${idx}.mp4`,
      mimeType: 'video/mp4',
      dataBase64: btoa('a'),
    }));

    const data = JSON.stringify({
      version: 2,
      exported: new Date().toISOString(),
      demoVideos,
    });

    await indexedDbStorage.import(data, true);
    await expect(indexedDbStorage.demoVideos.getAll()).resolves.toHaveLength(
      126,
    );
  });

  it('rejects a video that exceeds the 50 MB per-video limit', async () => {
    // Simulate a base64 payload whose decoded size exceeds 50 MB.
    // base64 length needed: ceil(50MB + 1) / 0.75 chars.
    const overLimitBase64Length = Math.ceil((50 * 1024 * 1024 + 1) / 0.75);
    const data = JSON.stringify({
      version: 2,
      exported: new Date().toISOString(),
      demoVideos: [
        {
          id: 'big-vid',
          fileName: 'big.mp4',
          mimeType: 'video/mp4',
          // Use a string of the right length (content doesn\'t matter for size check).
          dataBase64: 'A'.repeat(overLimitBase64Length),
        },
      ],
    });

    await expect(indexedDbStorage.import(data, true)).rejects.toThrow(
      'exceeds the 50 MB per-video limit',
    );
    await expect(indexedDbStorage.demoVideos.getAll()).resolves.toHaveLength(0);
  });

  it('rejects imports with unsupported version numbers', async () => {
    const data = JSON.stringify({
      version: 999999,
      exported: new Date().toISOString(),
      games: [],
    });

    await expect(indexedDbStorage.import(data, false)).rejects.toThrow();
    await expect(indexedDbStorage.games.getAll()).resolves.toHaveLength(0);
  });

  it('rejects imports with referential integrity issues', async () => {
    const data = JSON.stringify({
      version: 1,
      exported: new Date().toISOString(),
      games: [
        {
          id: 'game-1',
          name: 'Game 1',
          buttonLayout: ['A'],
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      characters: [
        {
          id: 'char-orphan',
          gameId: 'missing-game',
          name: 'Orphan Char',
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      combos: [
        {
          id: 'combo-orphan',
          characterId: 'missing-char',
          name: 'Orphan Combo',
          notation: 'A',
          parsedNotation: [],
          tags: [],
          sortOrder: 0,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });

    await expect(indexedDbStorage.import(data, false)).rejects.toThrow(
      'Import has referential integrity issues: 1 orphaned characters, 1 orphaned combos',
    );
    await expect(indexedDbStorage.games.getAll()).resolves.toHaveLength(0);
    await expect(indexedDbStorage.characters.getAll()).resolves.toHaveLength(0);
    await expect(indexedDbStorage.combos.getAll()).resolves.toHaveLength(0);
  });
});
