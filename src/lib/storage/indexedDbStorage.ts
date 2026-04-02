import Dexie, { type EntityTable } from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import type {
	Game,
	Character,
	Combo,
	UserSettings,
	NotationColors,
} from '../types';
import { DEFAULT_SETTINGS } from '../defaults';
import { importDataSchema } from '../schemas';

export interface DemoVideo {
	id: string;
	data: ArrayBuffer;
	mimeType: string;
	fileName: string;
}

const db = new Dexie('FightingGameComboTracker') as Dexie & {
	games: EntityTable<Game, 'id'>;
	characters: EntityTable<Character, 'id'>;
	combos: EntityTable<Combo, 'id'>;
	settings: EntityTable<UserSettings & { id: number }, 'id'>;
	demoVideos: EntityTable<DemoVideo, 'id'>;
};

db.version(1).stores({
	games: 'id, name, createdAt',
	characters: 'id, gameId, name, createdAt',
	combos: 'id, characterId, name, notation, createdAt, updatedAt, *tags',
	settings: 'id',
});

db.version(2)
	.stores({
		games: 'id, name, createdAt',
		characters: 'id, gameId, name, createdAt',
		combos:
			'id, characterId, name, notation, createdAt, updatedAt, *tags, sortOrder',
		settings: 'id',
	})
	.upgrade((tx) => {
		return tx
			.table('combos')
			.toCollection()
			.modify((combo) => {
				if (combo.sortOrder === undefined) {
					combo.sortOrder = combo.createdAt;
				}
			});
	});

db.version(3).stores({
	games: 'id, name, createdAt',
	characters: 'id, gameId, name, createdAt',
	combos:
		'id, characterId, name, notation, createdAt, updatedAt, *tags, sortOrder',
	settings: 'id',
	demoVideos: 'id',
});

// Version 4: no schema changes — reserved for future migration.
// Dexie requires strictly increasing version numbers; this bump
// holds the slot without modifying any table definitions.
db.version(4).stores({
	games: 'id, name, createdAt',
	characters: 'id, gameId, name, createdAt',
	combos:
		'id, characterId, name, notation, createdAt, updatedAt, *tags, sortOrder',
	settings: 'id',
	demoVideos: 'id',
});

function generateId(): string {
	return uuidv4();
}

/**
 * One-time migration: older versions stored notationColors as oklch() strings.
 * Map the two known defaults to their correct hex equivalents; any other
 * unknown oklch value (produced by the now-removed buggy hexToOklch) falls
 * back to the corresponding default since the stored value was incorrect anyway.
 */
const OKLCH_TO_HEX: Record<string, string> = {
	'oklch(0.85 0.05 265)': '#bdceef',
	'oklch(0.55 0.02 265)': '#6c727e',
};

function migrateNotationColors(colors: Record<string, string>): {
	colors: Record<string, string>;
	changed: boolean;
} {
	const migrated = { ...colors };
	let changed = false;
	for (const key of Object.keys(colors)) {
		const val = colors[key];
		if (typeof val === 'string' && val.startsWith('oklch(')) {
			const fallback =
				key in DEFAULT_SETTINGS.notationColors
					? (DEFAULT_SETTINGS.notationColors as Record<string, string>)[key]
					: '#bdceef';
			migrated[key] = OKLCH_TO_HEX[val] ?? fallback;
			changed = true;
		}
	}
	return { colors: migrated, changed };
}

export const indexedDbStorage = {
	games: {
		getAll: () => db.games.toArray(),
		get: (id: string) => db.games.get(id),
		add: async (game: Omit<Game, 'id' | 'createdAt' | 'updatedAt'>) => {
			const id = generateId();
			const now = Date.now();
			await db.games.add({
				...game,
				id,
				createdAt: now,
				updatedAt: now,
			});
			return id;
		},
		update: async (id: string, updates: Partial<Game>) => {
			await db.games.update(id, {
				...updates,
				updatedAt: Date.now(),
			});
		},
		delete: async (id: string) => {
			await db.transaction(
				'rw',
				[db.games, db.characters, db.combos],
				async () => {
					const characters = await db.characters
						.where('gameId')
						.equals(id)
						.toArray();
					for (const char of characters) {
						await db.combos.where('characterId').equals(char.id).delete();
					}
					await db.characters.where('gameId').equals(id).delete();
					await db.games.delete(id);
				},
			);
		},
	},

	characters: {
		getAll: () => db.characters.toArray(),
		getByGame: (gameId: string) =>
			db.characters.where('gameId').equals(gameId).toArray(),
		get: (id: string) => db.characters.get(id),
		add: async (
			character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>,
		) => {
			const id = generateId();
			const now = Date.now();
			await db.characters.add({
				...character,
				id,
				createdAt: now,
				updatedAt: now,
			});
			return id;
		},
		update: async (id: string, updates: Partial<Character>) => {
			await db.characters.update(id, {
				...updates,
				updatedAt: Date.now(),
			});
		},
		delete: async (id: string) => {
			await db.transaction('rw', [db.characters, db.combos], async () => {
				await db.combos.where('characterId').equals(id).delete();
				await db.characters.delete(id);
			});
		},
	},

	combos: {
		getAll: () => db.combos.toArray(),
		getByCharacter: (characterId: string) =>
			db.combos.where('characterId').equals(characterId).sortBy('sortOrder'),
		get: (id: string) => db.combos.get(id),
		add: async (
			combo: Omit<Combo, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'>,
		) => {
			const id = generateId();
			const now = Date.now();
			const existing = await db.combos
				.where('characterId')
				.equals(combo.characterId)
				.count();
			await db.combos.add({
				...combo,
				id,
				sortOrder: existing,
				createdAt: now,
				updatedAt: now,
			});
			return id;
		},
		update: async (id: string, updates: Partial<Combo>) => {
			await db.combos.update(id, {
				...updates,
				updatedAt: Date.now(),
			});
		},
		delete: (id: string) => db.combos.delete(id),
		reorder: async (orderedIds: string[]) => {
			await db.transaction('rw', db.combos, async () => {
				for (let i = 0; i < orderedIds.length; i++) {
					await db.combos.update(orderedIds[i], { sortOrder: i });
				}
			});
		},
		search: async (query: string) => {
			const lowerQuery = query.toLowerCase();
			const allCombos = await db.combos.toArray();
			return allCombos.filter(
				(combo) =>
					combo.name.toLowerCase().includes(lowerQuery) ||
					combo.notation.toLowerCase().includes(lowerQuery) ||
					combo.description?.toLowerCase().includes(lowerQuery) ||
					combo.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)),
			);
		},
	},

	settings: {
		get: async () => {
			const settings = await db.settings.get(1);
			if (!settings) {
				await db.settings.add({ id: 1, ...DEFAULT_SETTINGS });
				return DEFAULT_SETTINGS;
			}
			const { id: _id, ...rest } = settings;
			const { colors: migratedColors, changed } = migrateNotationColors(
				rest.notationColors,
			);
			if (changed) {
				await db.settings.update(1, {
					notationColors: migratedColors as NotationColors,
				});
				return { ...rest, notationColors: migratedColors as NotationColors };
			}
			return rest;
		},
		update: async (updates: Partial<UserSettings>) => {
			const current = await db.settings.get(1);
			if (!current) {
				await db.settings.add({ id: 1, ...DEFAULT_SETTINGS, ...updates });
			} else {
				await db.settings.update(1, updates);
			}
		},
	},

	demoVideos: {
		get: async (id: string) => db.demoVideos.get(id),
		add: async (video: DemoVideo) => {
			await db.demoVideos.add(video);
			return video.id;
		},
		delete: async (id: string) => db.demoVideos.delete(id),
		getAll: () => db.demoVideos.toArray(),
		getBlobUrl: async (id: string) => {
			const video = await db.demoVideos.get(id);
			if (!video) return null;
			const blob = new Blob([video.data], { type: video.mimeType });
			return URL.createObjectURL(blob);
		},
	},

	export: async (
		includeVideos = false,
		filter?: {
			gameIds?: string[];
			characterIds?: string[];
			comboIds?: string[];
		},
	) => {
		let [games, characters, combos, settings] = await db.transaction(
			'r',
			[db.games, db.characters, db.combos, db.settings],
			() =>
				Promise.all([
					db.games.toArray(),
					db.characters.toArray(),
					db.combos.toArray(),
					db.settings.get(1),
				]),
		);

		if (filter) {
			if (filter.gameIds) {
				const gameIdSet = new Set(filter.gameIds);
				games = games.filter((g) => gameIdSet.has(g.id));
			}
			if (filter.characterIds) {
				const charIdSet = new Set(filter.characterIds);
				characters = characters.filter((c) => charIdSet.has(c.id));
			}
			if (filter.comboIds) {
				const comboIdSet = new Set(filter.comboIds);
				combos = combos.filter((c) => comboIdSet.has(c.id));
			}
		}

		let videos:
			| Array<{
					id: string;
					fileName: string;
					mimeType: string;
					dataBase64: string;
			  }>
			| undefined;
		if (includeVideos) {
			const localVideoIds = new Set(
				combos
					.filter((c) => c.demoUrl?.startsWith('local:'))
					.map((c) => c.demoUrl?.replace('local:', '')),
			);
			const allVideos = await db.demoVideos.toArray();
			videos = allVideos
				.filter((v) => localVideoIds.has(v.id))
				.map((v) => ({
					id: v.id,
					fileName: v.fileName,
					mimeType: v.mimeType,
					dataBase64: arrayBufferToBase64(v.data),
				}));
		}

		return JSON.stringify(
			{
				version: includeVideos ? 2 : 1,
				exported: new Date().toISOString(),
				games,
				characters,
				combos,
				settings,
				...(videos ? { demoVideos: videos } : {}),
			},
			null,
			2,
		);
	},

	import: async (data: string, includeVideos = false) => {
		const json = JSON.parse(data);
		const parsed = importDataSchema.parse(json);

		await db.transaction(
			'rw',
			[db.games, db.characters, db.combos, db.settings, db.demoVideos],
			async () => {
				if (parsed.games) {
					for (const game of parsed.games) {
						await db.games.put(game);
					}
				}
				if (parsed.characters) {
					for (const character of parsed.characters) {
						await db.characters.put(character);
					}
				}
				if (parsed.combos) {
					for (const combo of parsed.combos) {
						await db.combos.put(combo);
					}
				}
				if (parsed.settings) {
					await db.settings.put({
						id: 1,
						...parsed.settings,
					});
				}
				if (includeVideos && parsed.demoVideos) {
					for (const v of parsed.demoVideos) {
						await db.demoVideos.put({
							id: v.id,
							fileName: v.fileName,
							mimeType: v.mimeType,
							data: base64ToArrayBuffer(v.dataBase64),
						});
					}
				}
			},
		);
	},
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	const CHUNK = 8192;
	let binary = '';
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}

export { db };
