import { useCallback, useState } from 'react';
import type { Game } from '@/lib/types';

/**
 * Manages game dialog state (add/edit)
 */
export function useGameOperations() {
	const [gameDialogOpen, setGameDialogOpen] = useState(false);
	const [editingGame, setEditingGame] = useState<Game | null>(null);

	const openEditDialog = useCallback((game: Game) => {
		setEditingGame(game);
		setGameDialogOpen(true);
	}, []);

	const openAddDialog = useCallback(() => {
		setEditingGame(null);
		setGameDialogOpen(true);
	}, []);

	return {
		gameDialogOpen,
		setGameDialogOpen,
		editingGame,
		setEditingGame,
		openEditDialog,
		openAddDialog,
	};
}
