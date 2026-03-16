import { create } from 'zustand';

interface AppState {
	selectedGameId: string | null;
	selectedCharacterId: string | null;
	selectedComboId: string | null;
	searchQuery: string;
	settingsVersion: number;

	setSelectedGame: (gameId: string | null) => void;
	setSelectedCharacter: (characterId: string | null) => void;
	setSelectedCombo: (comboId: string | null) => void;
	setSearchQuery: (query: string) => void;
	notifySettingsChanged: () => void;

	resetSelection: () => void;
}

export const useAppStore = create<AppState>((set) => ({
	selectedGameId: null,
	selectedCharacterId: null,
	selectedComboId: null,
	searchQuery: '',
	settingsVersion: 0,

	setSelectedGame: (gameId) =>
		set({
			selectedGameId: gameId,
			selectedCharacterId: null,
			selectedComboId: null,
		}),

	setSelectedCharacter: (characterId) =>
		set({
			selectedCharacterId: characterId,
			selectedComboId: null,
		}),

	setSelectedCombo: (comboId) => set({ selectedComboId: comboId }),

	setSearchQuery: (query) => set({ searchQuery: query }),

	notifySettingsChanged: () =>
		set((state) => ({ settingsVersion: state.settingsVersion + 1 })),

	resetSelection: () =>
		set({
			selectedGameId: null,
			selectedCharacterId: null,
			selectedComboId: null,
		}),
}));
