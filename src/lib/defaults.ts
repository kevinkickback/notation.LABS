import type { UserSettings } from './types';

export const DEFAULT_SETTINGS: UserSettings = {
	colorTheme: 'dark',
	fontFamily: 'system-ui',
	notationColors: {
		direction: 'oklch(0.85 0.05 265)',
		separator: 'oklch(0.55 0.02 265)',
	},
	displayMode: 'colored-text',
	iconStyle: 'round',
	uiTheme: 'default',
	comboScale: 1,
	autoUpdate: true,
	confirmBeforeDelete: true,
	videoPlayerSize: 'lg',
	gameCardSize: 180,
	characterCardSize: 180,
	notesDefaultOpen: false,
	showChangelogBeforeUpdate: true,
};
