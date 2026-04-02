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
	const charCountByGame = useMemo(() => {
		const map: Record<string, number> = {};
		for (const c of characters || []) {
			map[c.gameId] = (map[c.gameId] || 0) + 1;
		}
		return map;
	}, [characters]);

	const comboCountByGame = useMemo(() => {
		const charToGame: Record<string, string> = {};
		for (const c of characters || []) {
			charToGame[c.id] = c.gameId;
		}
		const map: Record<string, number> = {};
		for (const combo of combos || []) {
			const gameId = charToGame[combo.characterId];
			if (gameId) map[gameId] = (map[gameId] || 0) + 1;
		}
		return map;
	}, [characters, combos]);

	const lastModifiedByGame = useMemo(() => {
		const charToGame: Record<string, string> = {};
		for (const c of characters || []) {
			charToGame[c.id] = c.gameId;
		}
		const map: Record<string, number> = {};
		for (const g of games) {
			map[g.id] = g.updatedAt;
		}
		for (const c of characters || []) {
			if (c.updatedAt > (map[c.gameId] || 0)) map[c.gameId] = c.updatedAt;
		}
		for (const combo of combos || []) {
			const gameId = charToGame[combo.characterId];
			if (gameId && combo.updatedAt > (map[gameId] || 0))
				map[gameId] = combo.updatedAt;
		}
		return map;
	}, [games, characters, combos]);

	return {
		charCountByGame,
		comboCountByGame,
		lastModifiedByGame,
	};
}
