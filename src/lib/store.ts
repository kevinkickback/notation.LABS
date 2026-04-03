import { create } from 'zustand';

interface AppState {
  selectedGameId: string | null;
  selectedCharacterId: string | null;

  setSelectedGame: (gameId: string | null) => void;
  setSelectedCharacter: (characterId: string | null) => void;

  resetSelection: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedGameId: null,
  selectedCharacterId: null,

  setSelectedGame: (gameId) =>
    set({
      selectedGameId: gameId,
      selectedCharacterId: null,
    }),

  setSelectedCharacter: (characterId) =>
    set({
      selectedCharacterId: characterId,
    }),

  resetSelection: () =>
    set({
      selectedGameId: null,
      selectedCharacterId: null,
    }),
}));
