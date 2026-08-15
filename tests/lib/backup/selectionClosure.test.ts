import { describe, expect, it } from 'vitest';
import { closeBackupSelection } from '@/lib/backup/selectionClosure';
import type { Character, Combo, Game } from '@/lib/types';

const games: Game[] = [
  {
    id: 'game-1',
    name: 'Game 1',
    buttonLayout: [],
    notationProfile: 'standard',
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'game-2',
    name: 'Game 2',
    buttonLayout: [],
    notationProfile: 'standard',
    createdAt: 1,
    updatedAt: 1,
  },
];

const characters: Character[] = [
  {
    id: 'character-1',
    gameId: 'game-1',
    name: 'Fighter 1',
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'character-2',
    gameId: 'game-2',
    name: 'Fighter 2',
    createdAt: 1,
    updatedAt: 1,
  },
];

const combos: Combo[] = characters.map((character, index) => ({
  id: `combo-${index + 1}`,
  characterId: character.id,
  name: `Combo ${index + 1}`,
  notation: 'A',
  parsedNotation: [],
  tags: [],
  sortOrder: 0,
  createdAt: 1,
  updatedAt: 1,
}));

describe('closeBackupSelection', () => {
  it('includes required parents for a combo-only request', () => {
    const result = closeBackupSelection(
      { games, characters, combos },
      { comboIds: ['combo-1'] },
    );

    expect(result.games.map((game) => game.id)).toEqual(['game-1']);
    expect(result.characters.map((character) => character.id)).toEqual([
      'character-1',
    ]);
    expect(result.combos.map((combo) => combo.id)).toEqual(['combo-1']);
  });

  it('includes descendants and parents for a character request', () => {
    const result = closeBackupSelection(
      { games, characters, combos },
      { characterIds: ['character-2'] },
    );

    expect(result.games.map((game) => game.id)).toEqual(['game-2']);
    expect(result.characters.map((character) => character.id)).toEqual([
      'character-2',
    ]);
    expect(result.combos.map((combo) => combo.id)).toEqual(['combo-2']);
  });
});