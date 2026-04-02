import { create } from 'zustand';

interface AppState {
	selectedGameId: string | null;
	selectedCharacterId: string | null;
	selectedComboId: string | null;

	setSelectedGame: (gameId: string | null) => void;
	setSelectedCharacter: (characterId: string | null) => void;
	setSelectedCombo: (comboId: string | null) => void;

	resetSelection: () => void;
}

export const useAppStore = create<AppState>((set) => ({
	selectedGameId: null,
	selectedCharacterId: null,
	selectedComboId: null,

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

	resetSelection: () =>
		set({
			selectedGameId: null,
			selectedCharacterId: null,
			selectedComboId: null,
		}),
}));
