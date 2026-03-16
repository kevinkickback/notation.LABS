import { z } from 'zod';

const comboTokenSchema = z.object({
	type: z.enum([
		'direction',
		'motion',
		'button',
		'separator',
		'modifier',
		'repeat-start',
		'repeat-end',
		'unknown',
	]),
	value: z.string(),
	rawValue: z.string(),
	repeatCount: z.number().optional(),
});

const gameSchema = z.object({
	id: z.string(),
	name: z.string(),
	logoImage: z.string().optional(),
	coverZoom: z.number().optional(),
	coverPanX: z.number().optional(),
	coverPanY: z.number().optional(),
	buttonLayout: z.array(z.string()),
	buttonColors: z.record(z.string(), z.string()).optional(),
	notes: z.string().optional(),
	createdAt: z.number(),
	updatedAt: z.number(),
});

const characterSchema = z.object({
	id: z.string(),
	gameId: z.string(),
	name: z.string(),
	portraitImage: z.string().optional(),
	portraitZoom: z.number().optional(),
	portraitPanX: z.number().optional(),
	portraitPanY: z.number().optional(),
	notes: z.string().optional(),
	createdAt: z.number(),
	updatedAt: z.number(),
});

const comboSchema = z.object({
	id: z.string(),
	characterId: z.string(),
	name: z.string(),
	notation: z.string(),
	parsedNotation: z.array(comboTokenSchema),
	description: z.string().optional(),
	difficulty: z.number().optional(),
	damage: z.string().optional(),
	meterCost: z.string().optional(),
	tags: z.array(z.string()),
	demoUrl: z.string().optional(),
	demoFileName: z.string().optional(),
	demoVideoTitle: z.string().optional(),
	notes: z.string().optional(),
	outdated: z.boolean().optional(),
	sortOrder: z.number(),
	createdAt: z.number(),
	updatedAt: z.number(),
});

const settingsSchema = z.object({
	colorTheme: z.enum(['light', 'dark']),
	fontFamily: z.enum([
		'system-ui',
		'jetbrains-mono',
		'verdana',
		'space-grotesk',
	]),
	notationColors: z
		.object({
			direction: z.string(),
			separator: z.string(),
		})
		.catchall(z.string()),
	displayMode: z.enum(['colored-text', 'visual-icons']),
	iconStyle: z.enum(['round', 'square', 'hexagon']),
	uiTheme: z.string(),
	comboScale: z.number(),
	autoUpdate: z.boolean(),
	confirmBeforeDelete: z.boolean(),
	videoPlayerSize: z.enum(['sm', 'md', 'lg', 'xl']),
	gameCardSize: z.number(),
	characterCardSize: z.number(),
	lastUpdateCheck: z.number().optional(),
	lastSeenVersion: z.string().optional(),
	showChangelogBeforeUpdate: z.boolean(),
});

const demoVideoSchema = z.object({
	id: z.string(),
	fileName: z.string(),
	mimeType: z.string(),
	dataBase64: z.string(),
});

export const importDataSchema = z.object({
	version: z.number(),
	exported: z.string(),
	games: z.array(gameSchema).optional(),
	characters: z.array(characterSchema).optional(),
	combos: z.array(comboSchema).optional(),
	settings: settingsSchema.optional(),
	demoVideos: z.array(demoVideoSchema).optional(),
});
