import { resolveNotationProfile } from './notationProfiles';
import { parseComboNotation } from './parser';
import type { Character, Combo, Game } from './types';

type GameNotation = Pick<Game, 'buttonLayout' | 'notationProfile'>;

export function haveSameGameNotation(
  a: GameNotation,
  b: GameNotation,
): boolean {
  return (
    resolveNotationProfile(a) === resolveNotationProfile(b) &&
    a.buttonLayout.length === b.buttonLayout.length &&
    a.buttonLayout.every((button, index) => button === b.buttonLayout[index])
  );
}

/** Derived tokens always come from the current parent game, never backup metadata. */
export function parseComboRecords(
  combos: Combo[],
  games: Array<Pick<Game, 'id' | 'buttonLayout' | 'notationProfile'>>,
  characters: Array<Pick<Character, 'id' | 'gameId'>>,
): Combo[] {
  const gamesById = new Map(games.map((game) => [game.id, game]));
  const characterGames = new Map(
    characters.map((character) => [character.id, character.gameId]),
  );
  return combos.map((combo) => {
    const gameId = characterGames.get(combo.characterId);
    const game = gameId ? gamesById.get(gameId) : undefined;
    return {
      ...combo,
      parsedNotation: parseComboNotation(combo.notation, game?.buttonLayout, {
        profile: game ? resolveNotationProfile(game) : undefined,
      }),
    };
  });
}
