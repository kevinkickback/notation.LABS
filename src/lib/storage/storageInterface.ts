import type { Game, Character, Combo, UserSettings } from '../types';

export interface StorageInterface {
	games: {
		getAll: () => Promise<Game[]>;
		get: (id: string) => Promise<Game | undefined>;
		add: (
			game: Omit<Game, 'id' | 'createdAt' | 'updatedAt'>,
		) => Promise<string>;
		update: (id: string, updates: Partial<Game>) => Promise<void>;
		delete: (id: string) => Promise<void>;
	};

	characters: {
		getAll: () => Promise<Character[]>;
		getByGame: (gameId: string) => Promise<Character[]>;
		get: (id: string) => Promise<Character | undefined>;
		add: (
			character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>,
		) => Promise<string>;
		update: (id: string, updates: Partial<Character>) => Promise<void>;
		delete: (id: string) => Promise<void>;
	};

	combos: {
		getAll: () => Promise<Combo[]>;
		getByCharacter: (characterId: string) => Promise<Combo[]>;
		get: (id: string) => Promise<Combo | undefined>;
		add: (
			combo: Omit<Combo, 'id' | 'createdAt' | 'updatedAt'>,
		) => Promise<string>;
		update: (id: string, updates: Partial<Combo>) => Promise<void>;
		delete: (id: string) => Promise<void>;
		search: (query: string) => Promise<Combo[]>;
	};

	settings: {
		get: () => Promise<UserSettings>;
		update: (updates: Partial<UserSettings>) => Promise<void>;
	};

	export: () => Promise<string>;
	import: (data: string) => Promise<void>;
}
