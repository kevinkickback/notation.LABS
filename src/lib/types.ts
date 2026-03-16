export interface Game {
	id: string;
	name: string;
	logoImage?: string;
	coverZoom?: number;
	coverPanX?: number;
	coverPanY?: number;
	buttonLayout: string[];
	buttonColors?: Record<string, string>;
	notes?: string;
	createdAt: number;
	updatedAt: number;
}

export interface Character {
	id: string;
	gameId: string;
	name: string;
	portraitImage?: string;
	portraitZoom?: number;
	portraitPanX?: number;
	portraitPanY?: number;
	notes?: string;
	createdAt: number;
	updatedAt: number;
}

export interface Combo {
	id: string;
	characterId: string;
	name: string;
	notation: string;
	parsedNotation: ComboToken[];
	description?: string;
	difficulty?: number;
	damage?: string;
	meterCost?: string;
	tags: string[];
	demoUrl?: string;
	demoFileName?: string;
	demoVideoTitle?: string;
	notes?: string;
	outdated?: boolean;
	sortOrder: number;
	createdAt: number;
	updatedAt: number;
}

export type TokenType =
	| 'direction'
	| 'motion'
	| 'button'
	| 'separator'
	| 'modifier'
	| 'repeat-start'
	| 'repeat-end'
	| 'unknown';

export interface ComboToken {
	type: TokenType;
	value: string;
	rawValue: string;
	repeatCount?: number;
}

export type FontFamily =
	| 'system-ui'
	| 'jetbrains-mono'
	| 'verdana'
	| 'space-grotesk';

export interface UserSettings {
	colorTheme: 'light' | 'dark';
	fontFamily: FontFamily;
	notationColors: NotationColors;
	displayMode: DisplayMode;
	iconStyle: IconStyle;
	uiTheme: string;
	comboScale: number;
	autoUpdate: boolean;
	confirmBeforeDelete: boolean;
	videoPlayerSize: 'sm' | 'md' | 'lg' | 'xl';
	gameCardSize: number;
	characterCardSize: number;
	lastUpdateCheck?: number;
	lastSeenVersion?: string;
	showChangelogBeforeUpdate: boolean;
}

export interface NotationColors {
	direction: string;
	separator: string;
	[key: string]: string;
}

export type DisplayMode = 'colored-text' | 'visual-icons';

export type IconStyle = 'round' | 'square' | 'hexagon';

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
