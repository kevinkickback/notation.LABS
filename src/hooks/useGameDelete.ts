import { useState } from 'react';
import type { Game } from '@/lib/types';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { removeNotesOverride } from '@/hooks/useNotesOverride';
import { toast } from 'sonner';

/**
 * Manages game delete confirmation state and operations
 */
export function useGameDelete() {
	const [deleteTarget, setDeleteTarget] = useState<Game | null>(null);

	const handleDeleteGame = async (game: Game) => {
		try {
			await indexedDbStorage.games.delete(game.id);
			removeNotesOverride(game.id);
			toast.success(`"${game.name}" deleted`);
			setDeleteTarget(null);
		} catch {
			toast.error('Failed to delete game');
		}
	};

	return {
		deleteTarget,
		setDeleteTarget,
		handleDeleteGame,
	};
}
