import { useState } from 'react';
import type { Game } from '@/lib/types';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { reportError } from '@/lib/errors';
import { toast } from 'sonner';

/**
 * Manages game delete confirmation state and operations
 */
export function useGameDelete() {
	const [deleteTarget, setDeleteTarget] = useState<Game | null>(null);

	const handleDeleteGame = async (game: Game) => {
		try {
			await indexedDbStorage.games.delete(game.id);
			toast.success(`"${game.name}" deleted`);
			setDeleteTarget(null);
		} catch (err) {
			reportError('useGameDelete.handleDeleteGame', err);
			toast.error('Failed to delete game');
		}
	};

	return {
		deleteTarget,
		setDeleteTarget,
		handleDeleteGame,
	};
}
