import { useMemo } from 'react';
import type { Game, Character, Combo } from '@/lib/types';

/**
 * Computes game statistics (character counts, combo counts, last modified)
 */
export function useGameStats(
	games: Game[],
	characters: Character[] | undefined,
	combos: Combo[] | undefined,
) {
	return useMemo(() => {
		const charCountByGame: Record<string, number> = {};
		const comboCountByGame: Record<string, number> = {};
		const lastModifiedByGame: Record<string, number> = {};
		const charToGame: Record<string, string> = {};

		for (const game of games) {
			lastModifiedByGame[game.id] = game.updatedAt;
		}

		for (const character of characters || []) {
			charToGame[character.id] = character.gameId;
			charCountByGame[character.gameId] =
				(charCountByGame[character.gameId] || 0) + 1;

			if (character.updatedAt > (lastModifiedByGame[character.gameId] || 0)) {
				lastModifiedByGame[character.gameId] = character.updatedAt;
			}
		}

		for (const combo of combos || []) {
			const gameId = charToGame[combo.characterId];
			if (!gameId) {
				continue;
			}

			comboCountByGame[gameId] = (comboCountByGame[gameId] || 0) + 1;
			if (combo.updatedAt > (lastModifiedByGame[gameId] || 0)) {
				lastModifiedByGame[gameId] = combo.updatedAt;
			}
		}

		return {
			charCountByGame,
			comboCountByGame,
			lastModifiedByGame,
		};
	}, [games, characters, combos]);
}
