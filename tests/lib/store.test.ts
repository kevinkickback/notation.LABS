import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/lib/store';

describe('useAppStore', () => {
	beforeEach(() => {
		// Reset store between tests
		useAppStore.setState({
			selectedGameId: null,
			selectedCharacterId: null,
		});
	});

	describe('setSelectedGame', () => {
		it('sets the selected game ID', () => {
			useAppStore.getState().setSelectedGame('game-1');
			expect(useAppStore.getState().selectedGameId).toBe('game-1');
		});

		it('clears character selection when selecting a game', () => {
			useAppStore.setState({
				selectedGameId: 'game-1',
				selectedCharacterId: 'char-1',
			});
			useAppStore.getState().setSelectedGame('game-2');
			expect(useAppStore.getState().selectedGameId).toBe('game-2');
			expect(useAppStore.getState().selectedCharacterId).toBeNull();
		});

		it('clears game when set to null', () => {
			useAppStore.setState({ selectedGameId: 'game-1' });
			useAppStore.getState().setSelectedGame(null);
			expect(useAppStore.getState().selectedGameId).toBeNull();
		});
	});

	describe('setSelectedCharacter', () => {
		it('sets the selected character ID', () => {
			useAppStore.getState().setSelectedCharacter('char-1');
			expect(useAppStore.getState().selectedCharacterId).toBe('char-1');
		});

		it('replaces the current character selection', () => {
			useAppStore.setState({
				selectedCharacterId: 'char-1',
			});
			useAppStore.getState().setSelectedCharacter('char-2');
			expect(useAppStore.getState().selectedCharacterId).toBe('char-2');
		});

		it('does not affect game selection', () => {
			useAppStore.setState({ selectedGameId: 'game-1' });
			useAppStore.getState().setSelectedCharacter('char-1');
			expect(useAppStore.getState().selectedGameId).toBe('game-1');
		});
	});

	describe('resetSelection', () => {
		it('clears the remaining selections', () => {
			useAppStore.setState({
				selectedGameId: 'game-1',
				selectedCharacterId: 'char-1',
			});
			useAppStore.getState().resetSelection();
			expect(useAppStore.getState().selectedGameId).toBeNull();
			expect(useAppStore.getState().selectedCharacterId).toBeNull();
		});
	});
});
