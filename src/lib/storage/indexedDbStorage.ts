import Dexie, { type EntityTable } from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import { removeNotesOverride } from '@/hooks/useNotesOverride';
import type {
	Game,
	Character,
	Combo,
	UserSettings,
	NotationColors,
} from '../types';
import { DEFAULT_SETTINGS } from '../defaults';
import { importDataSchema } from '../schemas';

const MAX_IMPORT_SIZE_BYTES = 50 * 1024 * 1024;
const MAX_IMPORT_VIDEOS = 100;

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

db.version(5).stores({
	games: 'id, name, createdAt',
	characters: 'id, gameId, name, createdAt',
	combos:
		'id, characterId, name, notation, description, createdAt, updatedAt, *tags, sortOrder',
	settings: 'id',
	demoVideos: 'id',
});

export function generateId(): string {
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

export function getLocalVideoId(demoUrl?: string): string | null {
	if (!demoUrl?.startsWith('local:')) {
		return null;
	}

	const videoId = demoUrl.slice('local:'.length);
	return videoId || null;
}

function collectLocalVideoIds(combos: Array<Pick<Combo, 'demoUrl'>>): string[] {
	const videoIds = new Set<string>();

	for (const combo of combos) {
		const videoId = getLocalVideoId(combo.demoUrl);
		if (videoId) {
			videoIds.add(videoId);
		}
	}

	return [...videoIds];
}

function toUniqueIds(ids: string[]): string[] {
	return [...new Set(ids)];
}

function sanitizeComboLocalVideo<T extends Combo>(
	combo: T,
	availableVideoIds: Set<string>,
): T {
	const videoId = getLocalVideoId(combo.demoUrl);
	if (!videoId || availableVideoIds.has(videoId)) {
		return combo;
	}

	return {
		...combo,
		demoUrl: undefined,
		demoFileName: undefined,
		demoVideoTitle: undefined,
	};
}

function sanitizeCombosLocalVideos(
	combos: Combo[],
	availableVideoIds: Set<string>,
): Combo[] {
	return combos.map((combo) =>
		sanitizeComboLocalVideo(combo, availableVideoIds),
	);
}

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
			let characterIds: string[] = [];
			await db.transaction(
				'rw',
				[db.games, db.characters, db.combos, db.demoVideos],
				async () => {
					const characters = await db.characters
						.where('gameId')
						.equals(id)
						.toArray();
					characterIds = characters.map((c) => c.id);

					if (characterIds.length > 0) {
						const combos = await db.combos
							.where('characterId')
							.anyOf(characterIds)
							.toArray();
						const videoIds = collectLocalVideoIds(combos);
						if (videoIds.length > 0) {
							await db.demoVideos.bulkDelete(videoIds);
						}
						await db.combos.where('characterId').anyOf(characterIds).delete();
					}
					await db.characters.where('gameId').equals(id).delete();
					await db.games.delete(id);
				},
			);
			for (const charId of characterIds) {
				removeNotesOverride(charId);
			}
			removeNotesOverride(id);
		},
		bulkDelete: async (ids: string[]) => {
			const uniqueIds = toUniqueIds(ids);
			if (uniqueIds.length === 0) {
				return;
			}

			let characterIds: string[] = [];
			await db.transaction(
				'rw',
				[db.games, db.characters, db.combos, db.demoVideos],
				async () => {
					const characters = await db.characters
						.where('gameId')
						.anyOf(uniqueIds)
						.toArray();
					characterIds = characters.map((c) => c.id);

					if (characterIds.length > 0) {
						const combos = await db.combos
							.where('characterId')
							.anyOf(characterIds)
							.toArray();
						const videoIds = collectLocalVideoIds(combos);
						if (videoIds.length > 0) {
							await db.demoVideos.bulkDelete(videoIds);
						}
						await db.combos.where('characterId').anyOf(characterIds).delete();
					}

					await db.characters.where('gameId').anyOf(uniqueIds).delete();
					await db.games.bulkDelete(uniqueIds);
				},
			);

			for (const charId of characterIds) {
				removeNotesOverride(charId);
			}
			for (const gameId of uniqueIds) {
				removeNotesOverride(gameId);
			}
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
			await db.transaction(
				'rw',
				[db.characters, db.combos, db.demoVideos],
				async () => {
					const combos = await db.combos
						.where('characterId')
						.equals(id)
						.toArray();
					const videoIds = collectLocalVideoIds(combos);
					if (videoIds.length > 0) {
						await db.demoVideos.bulkDelete(videoIds);
					}
					await db.combos.where('characterId').equals(id).delete();
					await db.characters.delete(id);
				},
			);
			removeNotesOverride(id);
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
			await db.transaction('rw', db.combos, async () => {
				const existing = await db.combos
					.where('characterId')
					.equals(combo.characterId)
					.toArray();
				const maxOrder = existing.reduce(
					(max, current) => Math.max(max, current.sortOrder ?? 0),
					-1,
				);
				await db.combos.add({
					...combo,
					id,
					sortOrder: maxOrder + 1,
					createdAt: now,
					updatedAt: now,
				});
			});
			return id;
		},
		update: async (id: string, updates: Partial<Combo>) => {
			await db.combos.update(id, {
				...updates,
				updatedAt: Date.now(),
			});
		},
		delete: async (id: string) => {
			await db.transaction('rw', [db.combos, db.demoVideos], async () => {
				const combo = await db.combos.get(id);
				const videoId = getLocalVideoId(combo?.demoUrl);
				if (videoId) {
					await db.demoVideos.delete(videoId);
				}
				await db.combos.delete(id);
			});
		},
		bulkDelete: async (ids: string[]) => {
			const uniqueIds = toUniqueIds(ids);
			if (uniqueIds.length === 0) {
				return;
			}

			await db.transaction('rw', [db.combos, db.demoVideos], async () => {
				const combos = (await db.combos.bulkGet(uniqueIds)).filter(
					(combo): combo is Combo => combo !== undefined,
				);
				const videoIds = collectLocalVideoIds(combos);
				if (videoIds.length > 0) {
					await db.demoVideos.bulkDelete(videoIds);
				}
				await db.combos.bulkDelete(uniqueIds);
			});
		},
		markOutdated: async (ids: string[], outdated: boolean) => {
			const uniqueIds = toUniqueIds(ids);
			if (uniqueIds.length === 0) {
				return;
			}

			await db.transaction('rw', db.combos, async () => {
				for (const id of uniqueIds) {
					await db.combos.update(id, {
						outdated: outdated || undefined,
						updatedAt: Date.now(),
					});
				}
			});
		},
		reorder: async (orderedIds: string[]) => {
			await db.transaction('rw', db.combos, async () => {
				for (let i = 0; i < orderedIds.length; i++) {
					await db.combos.update(orderedIds[i], { sortOrder: i });
				}
			});
		},
		search: async (query: string) => {
			const trimmedQuery = query.trim();
			if (!trimmedQuery) {
				return [];
			}

			const [nameMatches, notationMatches, descriptionMatches, tagMatches] =
				await Promise.all([
					db.combos.where('name').startsWithIgnoreCase(trimmedQuery).toArray(),
					db.combos
						.where('notation')
						.startsWithIgnoreCase(trimmedQuery)
						.toArray(),
					db.combos
						.where('description')
						.startsWithIgnoreCase(trimmedQuery)
						.toArray(),
					db.combos.where('tags').startsWithIgnoreCase(trimmedQuery).toArray(),
				]);

			const unique = new Map<string, Combo>();
			for (const combo of [
				...nameMatches,
				...notationMatches,
				...descriptionMatches,
				...tagMatches,
			]) {
				unique.set(combo.id, combo);
			}

			return [...unique.values()].sort((a, b) => a.sortOrder - b.sortOrder);
		},
	},

	settings: {
		/**
		 * Read-only query — safe to call inside useLiveQuery.
		 * Returns stored settings, or the defaults if none exist yet.
		 */
		get: async (): Promise<UserSettings> => {
			const settings = await db.settings.get(1);
			if (!settings) return DEFAULT_SETTINGS;
			const { id: _id, ...rest } = settings;
			return rest;
		},
		/**
		 * Runs once at app startup (outside any liveQuery context).
		 * Initialises the settings row on first launch and applies
		 * any pending data migrations (e.g. oklch → hex colour values).
		 */
		init: async (): Promise<void> => {
			const settings = await db.settings.get(1);
			if (!settings) {
				await db.settings.add({ id: 1, ...DEFAULT_SETTINGS });
				return;
			}
			const { colors: migratedColors, changed } = migrateNotationColors(
				settings.notationColors,
			);
			if (changed) {
				await db.settings.update(1, {
					notationColors: migratedColors as NotationColors,
				});
			}
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

	gameStats: {
		getInputs: async () => {
			const [characters, combos] = await db.transaction(
				'r',
				[db.characters, db.combos],
				() => Promise.all([db.characters.toArray(), db.combos.toArray()]),
			);

			return { characters, combos };
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

		let sanitizedCombos = combos;

		let videos:
			| Array<{
					id: string;
					fileName: string;
					mimeType: string;
					dataBase64: string;
			  }>
			| undefined;
		if (includeVideos) {
			const localVideoIds = new Set(collectLocalVideoIds(combos));
			const allVideos = await db.demoVideos.toArray();
			videos = allVideos
				.filter((v) => localVideoIds.has(v.id))
				.map((v) => ({
					id: v.id,
					fileName: v.fileName,
					mimeType: v.mimeType,
					dataBase64: arrayBufferToBase64(v.data),
				}));
			sanitizedCombos = sanitizeCombosLocalVideos(
				combos,
				new Set(videos.map((video) => video.id)),
			);
		} else {
			sanitizedCombos = sanitizeCombosLocalVideos(combos, new Set());
		}

		return JSON.stringify(
			{
				version: includeVideos ? 2 : 1,
				exported: new Date().toISOString(),
				games,
				characters,
				combos: sanitizedCombos,
				settings,
				...(videos ? { demoVideos: videos } : {}),
			},
			null,
			2,
		);
	},

	import: async (
		data: string,
		includeVideos = false,
		includeSettings = false,
	) => {
		const importSizeBytes = new Blob([data]).size;
		if (importSizeBytes > MAX_IMPORT_SIZE_BYTES) {
			throw new Error('Import file exceeds 50 MB limit');
		}

		const json = JSON.parse(data);
		const parsed = importDataSchema.parse(json);
		if (parsed.demoVideos && parsed.demoVideos.length > MAX_IMPORT_VIDEOS) {
			throw new Error(
				`Import contains ${parsed.demoVideos.length} videos; max is ${MAX_IMPORT_VIDEOS}`,
			);
		}

		const availableVideoIds = includeVideos
			? new Set((parsed.demoVideos ?? []).map((video) => video.id))
			: new Set<string>();
		const sanitizedCombos = parsed.combos
			? sanitizeCombosLocalVideos(parsed.combos, availableVideoIds)
			: undefined;

		const gameIds = new Set((parsed.games ?? []).map((game) => game.id));
		const characterIds = new Set(
			(parsed.characters ?? []).map((character) => character.id),
		);
		const orphanedCharacters = (parsed.characters ?? []).filter(
			(character) => !gameIds.has(character.gameId),
		);
		const orphanedCombos = (sanitizedCombos ?? []).filter(
			(combo) => !characterIds.has(combo.characterId),
		);
		if (orphanedCharacters.length > 0 || orphanedCombos.length > 0) {
			throw new Error(
				`Import has referential integrity issues: ${orphanedCharacters.length} orphaned characters, ${orphanedCombos.length} orphaned combos`,
			);
		}

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
				if (sanitizedCombos) {
					for (const combo of sanitizedCombos) {
						await db.combos.put(combo);
					}
				}
				if (includeSettings && parsed.settings) {
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
