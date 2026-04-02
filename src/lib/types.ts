// All entity types are derived from Zod schemas in schemas.ts.
// This eliminates manual sync between type definitions and validation schemas.
export type {
	ComboToken,
	TokenType,
	Game,
	Character,
	Combo,
	UserSettings,
	NotationColors,
	FontFamily,
	DisplayMode,
	IconStyle,
} from './schemas';

import type { Combo, Character, Game } from './schemas';

export type GameSort =
	| 'name-asc'
	| 'name-desc'
	| 'characters'
	| 'combos'
	| 'modified';

export interface ShareableCombo {
	combo: Combo;
	character: Character;
	game: Game;
}

export interface IGDBSearchResult {
	igdbId: number;
	name: string;
	coverImageId: string | null;
	firstReleaseDate: number | null;
}

export interface ImageSearchResult {
	title: string;
	thumbnailUrl: string;
	imageUrl: string;
	width: number;
	height: number;
}
