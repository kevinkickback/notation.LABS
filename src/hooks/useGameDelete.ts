import { useState } from 'react';
import { deleteGame, deleteGames } from '@/lib/application/gameCommands';
import { reportError } from '@/lib/errors';
import { notify } from '@/lib/notifications';
import type { Game } from '@/lib/types';

/**
 * Manages game delete confirmation state and operations
 */
export function useGameDelete() {
  const [deleteTarget, setDeleteTarget] = useState<Game | null>(null);

  const handleDeleteGame = async (game: Game) => {
    try {
      await deleteGame(game.id);
      notify.success(`"${game.name}" deleted`);
      setDeleteTarget(null);
      return true;
    } catch (err) {
      reportError('useGameDelete.handleDeleteGame', err);
      notify.error('Failed to delete game');
      return false;
    }
  };

  const handleBulkDeleteGames = async (games: Game[]) => {
    if (games.length === 0) {
      return false;
    }

    try {
      await deleteGames(games.map((game) => game.id));
      notify.success(
        `${games.length} game${games.length > 1 ? 's' : ''} deleted`,
      );
      setDeleteTarget(null);
      return true;
    } catch (err) {
      reportError('useGameDelete.handleBulkDeleteGames', err);
      notify.error('Failed to delete selected games');
      return false;
    }
  };

  return {
    deleteTarget,
    setDeleteTarget,
    handleDeleteGame,
    handleBulkDeleteGames,
  };
}
