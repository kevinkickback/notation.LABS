// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteGame, deleteGames } from '@/lib/application/gameCommands';
import { deleteCharacter, deleteCharacters } from '@/lib/application/characterCommands';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { db } from '@/lib/storage/database';
import type { Character, Combo, Game } from '@/lib/types';

const games: Game[] = ['removed-game', 'empty-game', 'kept-game'].map(id => ({ id, name: id, buttonLayout: ['A'], notationProfile: 'standard', createdAt: 1, updatedAt: 1 }));
const characters: Character[] = ['first', 'second', 'kept'].map(id => ({ id, gameId: id === 'kept' ? 'kept-game' : 'removed-game', name: id, createdAt: 1, updatedAt: 1 }));
const combos: Combo[] = [
  { id: 'exclusive', characterId: 'first', demoUrl: 'local:exclusive' },
  ...characters.map(character => ({ id: `shared-${character.id}`, characterId: character.id, demoUrl: 'local:shared' })),
].map(combo => ({ ...combo, name: combo.id, notation: 'A', parsedNotation: [], tags: [], sortOrder: 0, createdAt: 1, updatedAt: 1 }));
const videos = ['exclusive', 'shared', 'unrelated'].map(id => ({ id, data: new Uint8Array([1, 2, 3]).buffer, mimeType: 'video/mp4', fileName: `${id}.mp4` }));
const settings = { id: 1, ...DEFAULT_SETTINGS, comboScale: 1.5, notebookOpenPages: [...games.map(game => game.id), ...characters.map(character => character.id), 'unrelated-page'] };

const cases = [
  { name: 'single game', run: () => deleteGame('removed-game'), games: ['removed-game'], characters: ['first', 'second'] },
  { name: 'bulk games', run: () => deleteGames(['removed-game', 'empty-game', 'removed-game']), games: ['removed-game', 'empty-game'], characters: ['first', 'second'] },
  { name: 'single character', run: () => deleteCharacter('first'), games: [], characters: ['first'] },
  { name: 'bulk characters', run: () => deleteCharacters(['first', 'second', 'first']), games: [], characters: ['first', 'second'] },
];

async function snapshot() {
  return { games: await db.games.toArray(), characters: await db.characters.toArray(), combos: await db.combos.toArray(), videos: await db.demoVideos.toArray(), settings: await db.settings.toArray() };
}

beforeEach(async () => {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
    await db.games.bulkPut(games);
    await db.characters.bulkPut(characters);
    await db.combos.bulkPut(combos);
    await db.demoVideos.bulkPut(videos);
    await db.settings.put(settings);
  });
});
afterEach(() => vi.restoreAllMocks());

describe('atomic entity deletion', () => {
  it.each(cases)('deletes $name descendants, exclusive videos, and notebook choices together', async testCase => {
    const before = await snapshot();
    await testCase.run();
    const result = await snapshot();
    expect(result.games).toEqual(before.games.filter(game => !testCase.games.includes(game.id)));
    expect(result.characters).toEqual(before.characters.filter(character => !testCase.characters.includes(character.id)));
    expect(result.combos).toEqual(before.combos.filter(combo => !testCase.characters.includes(combo.characterId)));
    expect(result.videos).toEqual(before.videos.filter(video => video.id !== 'exclusive'));
    expect(result.settings).toEqual([{ ...settings, notebookOpenPages: settings.notebookOpenPages.filter(id => ![...testCase.games, ...testCase.characters].includes(id)) }]);
  });

  it.each(cases)('rolls every table back when $name notebook cleanup fails and allows retry', async testCase => {
    const before = await snapshot();
    const failure = vi.spyOn(db.settings, 'put').mockRejectedValueOnce(new Error('Preference quota exceeded'));
    await expect(testCase.run()).rejects.toThrow('Preference quota exceeded');
    failure.mockRestore();
    expect(await snapshot()).toEqual(before);
    await testCase.run();
    expect(await db.characters.get('first')).toBeUndefined();
    expect((await db.settings.get(1))?.notebookOpenPages).not.toContain('first');
  });

  it('rolls records and settings back when video cleanup fails', async () => {
    const before = await snapshot();
    const failure = vi.spyOn(db.demoVideos, 'delete').mockRejectedValueOnce(new Error('Video cleanup failed'));
    await expect(deleteGame('removed-game')).rejects.toThrow('Video cleanup failed');
    failure.mockRestore();
    expect(await snapshot()).toEqual(before);
  });

  it('serializes concurrent cascades and removes a shared video only after its final reference', async () => {
    await Promise.all([deleteCharacter('first'), deleteCharacter('second')]);
    expect(await db.demoVideos.get('shared')).toBeDefined();
    expect((await db.settings.get(1))?.notebookOpenPages).toEqual(settings.notebookOpenPages.filter(id => id !== 'first' && id !== 'second'));
    await deleteCharacter('kept');
    expect(await db.demoVideos.get('shared')).toBeUndefined();
    expect(await db.demoVideos.get('unrelated')).toBeDefined();
  });

  it.each([
    { name: 'game', run: () => deleteGame('removed-game'), remaining: ['empty-game', 'kept-game'] },
    { name: 'character', run: () => deleteCharacter('first'), remaining: ['removed-game', 'empty-game', 'kept-game', 'second'] },
  ])('normalizes legacy default-open settings inside a $name cascade', async testCase => {
    const { notebookOpenPages: _pages, ...legacy } = settings;
    await db.settings.put({ ...legacy, notesDefaultOpen: true, notesOverrides: ['kept'] });
    await testCase.run();
    const saved = await db.settings.get(1);
    expect(saved?.notebookOpenPages?.sort()).toEqual(testCase.remaining.sort());
    expect(saved).not.toHaveProperty('notesDefaultOpen');
    expect(saved).not.toHaveProperty('notesOverrides');
    expect(saved?.comboScale).toBe(1.5);
  });

  it('leaves all tables untouched for empty batches and tolerates missing IDs', async () => {
    const before = await snapshot();
    await deleteGames([]);
    await deleteCharacters([]);
    expect(await snapshot()).toEqual(before);
    await deleteGames(['missing', 'missing']);
    await deleteCharacters(['missing', 'missing']);
    expect(await snapshot()).toEqual(before);
  });

  it('initializes notebook preferences within deletion when no settings row exists', async () => {
    await db.settings.clear();
    await deleteCharacter('first');
    expect(await db.settings.get(1)).toEqual({ id: 1, ...DEFAULT_SETTINGS, notebookOpenPages: [] });
  });
});
