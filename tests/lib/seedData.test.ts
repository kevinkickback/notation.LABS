import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { initializeSeedData } from '@/lib/seedData';
import { indexedDbStorage, db } from '@/lib/storage/indexedDbStorage';

function assertDefined<T>(
  value: T | undefined | null,
): asserts value is NonNullable<T> {
  if (value === undefined || value === null) {
    throw new Error(`Expected value to be defined, but got ${value}`);
  }
}

beforeEach(async () => {
  await db.games.clear();
  await db.characters.clear();
  await db.combos.clear();
  await db.settings.clear();
  await db.demoVideos.clear();
});

describe('initializeSeedData', () => {
  it('creates seed games when database is empty', async () => {
    await initializeSeedData();
    const games = await indexedDbStorage.games.getAll();
    expect(games.length).toBeGreaterThanOrEqual(3);
    const gameNames = games.map((g) => g.name);
    expect(gameNames).toContain('Street Fighter 6');
    expect(gameNames).toContain('Guilty Gear Strive');
    expect(gameNames).toContain('Dragon Ball FighterZ');
  });

  it('creates seed characters', async () => {
    await initializeSeedData();
    const characters = await indexedDbStorage.characters.getAll();
    expect(characters.length).toBeGreaterThanOrEqual(4);
    const charNames = characters.map((c) => c.name);
    expect(charNames).toContain('Ryu');
    expect(charNames).toContain('Ken');
  });

  it('creates seed combos with parsed notation', async () => {
    await initializeSeedData();
    const combos = await indexedDbStorage.combos.getAll();
    expect(combos.length).toBeGreaterThanOrEqual(5);
    // Verify combos have parsed notation
    for (const combo of combos) {
      expect(combo.parsedNotation).toBeDefined();
      expect(Array.isArray(combo.parsedNotation)).toBe(true);
    }
  });

  it('does not re-seed when games already exist', async () => {
    await indexedDbStorage.games.add({ name: 'Existing', buttonLayout: [] });
    await initializeSeedData();
    const games = await indexedDbStorage.games.getAll();
    expect(games).toHaveLength(1);
    expect(games[0].name).toBe('Existing');
  });

  it('sets button layouts on games', async () => {
    await initializeSeedData();
    const games = await indexedDbStorage.games.getAll();
    const sf6 = games.find((g) => g.name === 'Street Fighter 6');
    assertDefined(sf6);
    expect(sf6.buttonLayout).toEqual(['LP', 'MP', 'HP', 'LK', 'MK', 'HK']);
  });

  it('sets button colors on games', async () => {
    await initializeSeedData();
    const games = await indexedDbStorage.games.getAll();
    const sf6 = games.find((g) => g.name === 'Street Fighter 6');
    assertDefined(sf6);
    assertDefined(sf6.buttonColors);
    expect(sf6.buttonColors.LP).toBeDefined();
  });

  it('creates combos with tags', async () => {
    await initializeSeedData();
    const combos = await indexedDbStorage.combos.getAll();
    const taggedCombos = combos.filter((c) => c.tags.length > 0);
    expect(taggedCombos.length).toBeGreaterThan(0);
  });
});
