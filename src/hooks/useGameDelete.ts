import { useState } from 'react';
import { toast } from 'sonner';
import { reportError } from '@/lib/errors';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import type { Game } from '@/lib/types';

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

  const handleBulkDeleteGames = async (games: Game[]) => {
    if (games.length === 0) {
      return;
    }

    try {
      await indexedDbStorage.games.bulkDelete(games.map((g) => g.id));
      toast.success(
        `${games.length} game${games.length > 1 ? 's' : ''} deleted`,
      );
      setDeleteTarget(null);
    } catch (err) {
      reportError('useGameDelete.handleBulkDeleteGames', err);
      toast.error('Failed to delete selected games');
    }
  };

  return {
    deleteTarget,
    setDeleteTarget,
    handleDeleteGame,
    handleBulkDeleteGames,
  };
}
