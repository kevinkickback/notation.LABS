import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/lib/store';

describe('page selection', () => {
  beforeEach(() => {
    useAppStore.setState({ selectedGameId: 'game-1', selectedCharacterId: 'char-1' });
  });

  it.each(['game-2', null])('clears character selection when selecting game %s', gameId => {
    useAppStore.getState().setSelectedGame(gameId);
    expect(useAppStore.getState().selectedGameId).toBe(gameId);
    expect(useAppStore.getState().selectedCharacterId).toBeNull();
  });

  it('changes the character without changing its selected game', () => {
    useAppStore.getState().setSelectedCharacter('char-2');
    expect(useAppStore.getState().selectedCharacterId).toBe('char-2');
    expect(useAppStore.getState().selectedGameId).toBe('game-1');
  });

  it('clears both selections when returning to the library', () => {
    useAppStore.getState().resetSelection();
    expect(useAppStore.getState().selectedGameId).toBeNull();
    expect(useAppStore.getState().selectedCharacterId).toBeNull();
  });
});
