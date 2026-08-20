import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DestructiveConfirmationDialog } from '@/components/shared/DestructiveConfirmationDialog';
import { SelectionToolbar } from '@/components/shared/SelectionToolbar';
import { useSettings } from '@/context/SettingsContext';
import { useGameDelete } from '@/hooks/useGameDelete';
import { useGameFilters } from '@/hooks/useGameFilters';
import { useGameOperations } from '@/hooks/useGameOperations';
import { useGameStatistics } from '@/hooks/useGameStatistics';
import { useGameStats } from '@/hooks/useGameStats';
import { useGameViewMode } from '@/hooks/useGameViewMode';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useSelection } from '@/hooks/useSelection';
import { setGameFavorite } from '@/lib/application/gameCommands';
import { compareEntityNames, compareFavoritesFirst } from '@/lib/entitySorting';
import { reportError } from '@/lib/errors';
import { useAppStore } from '@/lib/store';
import type { Game } from '@/lib/types';
import { GameFormDialog } from './GameFormDialog';
import { GameGridCard } from './GameGridCard';
import { GameLibraryEmptyState } from './GameLibraryEmptyState';
import { GameLibraryHeader } from './GameLibraryHeader';
import { GameLibraryToolbar } from './GameLibraryToolbar';
import { GameListCard } from './GameListCard';

interface GameLibraryProps {
  games: Game[];
}

export function GameLibrary({ games }: GameLibraryProps) {
  const isMobile = useIsMobile();
  const { setSelectedGame } = useAppStore();
  const settings = useSettings();
  const { isSelecting, setIsSelecting, selectedIds, setSelectedIds } =
    useSelection();
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const filters = useGameFilters();
  const viewMode = useGameViewMode(settings.gameCardSize);
  const deleteState = useGameDelete();
  const operations = useGameOperations();

  // Read stats inputs in one reactive transaction to reduce query churn.
  const gameStatsData = useGameStatistics();
  const characters = gameStatsData?.characters;
  const combos = gameStatsData?.combos;

  const stats = useGameStats(games, characters, combos);

  const filteredAndSorted = useMemo(() => {
    let result = [...games];
    if (filters.filterSearch) {
      const q = filters.filterSearch.toLowerCase();
      result = result.filter((g) => g.name.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      const favoriteOrder = compareFavoritesFirst(a, b);
      if (favoriteOrder !== 0) return favoriteOrder;

      let sortOrder: number;
      switch (filters.sortBy) {
        case 'name-asc':
          sortOrder = compareEntityNames(a, b);
          break;
        case 'name-desc':
          sortOrder = compareEntityNames(b, a);
          break;
        case 'characters':
          sortOrder =
            (stats.charCountByGame[b.id] || 0) -
            (stats.charCountByGame[a.id] || 0);
          break;
        case 'combos':
          sortOrder =
            (stats.comboCountByGame[b.id] || 0) -
            (stats.comboCountByGame[a.id] || 0);
          break;
        case 'modified':
          sortOrder =
            (stats.lastModifiedByGame[b.id] || 0) -
            (stats.lastModifiedByGame[a.id] || 0);
          break;
        default:
          sortOrder = 0;
      }
      return sortOrder || compareEntityNames(a, b);
    });
    return result;
  }, [
    games,
    filters.sortBy,
    filters.filterSearch,
    stats.charCountByGame,
    stats.comboCountByGame,
    stats.lastModifiedByGame,
  ]);

  const handleToggleFavorite = async (game: Game) => {
    try {
      await setGameFavorite(game.id, !game.favorite);
    } catch (error) {
      reportError('GameLibrary.toggleFavorite', error);
      toast.error('Failed to update favorite');
    }
  };

  // Handle delete with optional confirmation
  const handleDelete = async (game: Game) => {
    if (settings.confirmBeforeDelete) {
      deleteState.setDeleteTarget(game);
    } else {
      const deleted = await deleteState.handleDeleteGame(game);
      if (deleted) {
        setSelectedIds((prev) => {
          if (!prev.has(game.id)) return prev;
          const next = new Set(prev);
          next.delete(game.id);
          return next;
        });
      }
    }
  };

  // Handle confirmed delete
  const handleConfirmedDelete = async () => {
    if (deleteState.deleteTarget) {
      const deletedId = deleteState.deleteTarget.id;
      const deleted = await deleteState.handleDeleteGame(
        deleteState.deleteTarget,
      );
      if (deleted) {
        setSelectedIds((prev) => {
          if (!prev.has(deletedId)) return prev;
          const next = new Set(prev);
          next.delete(deletedId);
          return next;
        });
      }
    }
  };

  const handleGameSelect = (gameId: string) => {
    if (!isSelecting) {
      setSelectedGame(gameId);
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (settings.confirmBeforeDelete) {
      setBulkDeleteConfirm(true);
      return;
    }
    const selectedGames = games.filter((g) => selectedIds.has(g.id));
    const deleted = await deleteState.handleBulkDeleteGames(selectedGames);
    if (deleted) {
      setSelectedIds(new Set());
      setIsSelecting(false);
    }
  };

  const selectedCascadeCounts = useMemo(() => {
    let characterCount = 0;
    let comboCount = 0;
    for (const id of selectedIds) {
      characterCount += stats.charCountByGame[id] || 0;
      comboCount += stats.comboCountByGame[id] || 0;
    }
    return { characterCount, comboCount };
  }, [selectedIds, stats.charCountByGame, stats.comboCountByGame]);

  if (games.length === 0) {
    return (
      <>
        <GameLibraryEmptyState onAddGame={() => operations.openAddDialog()} />
        <GameFormDialog
          open={operations.gameDialogOpen}
          onOpenChange={operations.setGameDialogOpen}
          editingGame={operations.editingGame}
        />
      </>
    );
  }

  return (
    <div>
      {/* Header + Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 min-w-0">
        <GameLibraryHeader gameCount={games.length} />
        {isSelecting ? (
          <SelectionToolbar
            selectedCount={selectedIds.size}
            onSelectAll={() =>
              setSelectedIds(new Set(filteredAndSorted.map((g) => g.id)))
            }
            onDeselectAll={() => setSelectedIds(new Set())}
            onDelete={() => {
              void handleBulkDelete();
            }}
            onCancel={() => {
              setIsSelecting(false);
              setSelectedIds(new Set());
            }}
          />
        ) : (
          <GameLibraryToolbar
            filterSearch={filters.filterSearch}
            onFilterSearchChange={filters.setFilterSearch}
            sortBy={filters.sortBy}
            onSortByChange={filters.setSortBy}
            viewMode={viewMode.viewMode}
            onViewModeChange={viewMode.setViewMode}
            cardSize={viewMode.cardSize}
            onCardSizeChange={viewMode.handleCardSizeChange}
            onToggleSelect={() => setIsSelecting(true)}
            onAddGame={() => operations.openAddDialog()}
          />
        )}
      </div>

      {/* Games Grid/List */}
      <div
        className={
          viewMode.viewMode === 'list' ? 'flex flex-col gap-3' : 'grid gap-4'
        }
        style={
          viewMode.viewMode === 'grid'
            ? {
                gridTemplateColumns: `repeat(auto-fill, minmax(${viewMode.cardSize}px, 1fr))`,
              }
            : undefined
        }
      >
        {filteredAndSorted.map((game) =>
          viewMode.viewMode === 'grid' ? (
            <GameGridCard
              key={game.id}
              game={game}
              charCount={stats.charCountByGame[game.id] || 0}
              isMobile={isMobile}
              isSelecting={isSelecting}
              isSelected={selectedIds.has(game.id)}
              onSelect={() => handleGameSelect(game.id)}
              onEdit={() => operations.openEditDialog(game)}
              onDelete={() => handleDelete(game)}
              onToggleFavorite={() => void handleToggleFavorite(game)}
            />
          ) : (
            <GameListCard
              key={game.id}
              game={game}
              charCount={stats.charCountByGame[game.id] || 0}
              comboCount={stats.comboCountByGame[game.id] || 0}
              lastModified={stats.lastModifiedByGame[game.id] || game.updatedAt}
              isMobile={isMobile}
              isSelecting={isSelecting}
              isSelected={selectedIds.has(game.id)}
              onSelect={() => handleGameSelect(game.id)}
              onEdit={() => operations.openEditDialog(game)}
              onDelete={() => handleDelete(game)}
              onToggleFavorite={() => void handleToggleFavorite(game)}
            />
          ),
        )}
      </div>

      {/* Dialogs */}
      <GameFormDialog
        open={operations.gameDialogOpen}
        onOpenChange={operations.setGameDialogOpen}
        editingGame={operations.editingGame}
      />

      {settings.confirmBeforeDelete && (
        <DestructiveConfirmationDialog
          open={!!deleteState.deleteTarget}
          onOpenChange={(open) => !open && deleteState.setDeleteTarget(null)}
          title={`Delete ${deleteState.deleteTarget?.name}?`}
          description={(() => {
            if (!deleteState.deleteTarget) return '';
            const characterCount =
              stats.charCountByGame[deleteState.deleteTarget.id] || 0;
            const comboCount =
              stats.comboCountByGame[deleteState.deleteTarget.id] || 0;
            if (characterCount === 0) {
              return 'This game has no characters or combos. This action cannot be undone.';
            }
            return `This will also delete ${characterCount} character${characterCount !== 1 ? 's' : ''} and ${comboCount} combo${comboCount !== 1 ? 's' : ''}. This action cannot be undone.`;
          })()}
          onConfirm={handleConfirmedDelete}
        />
      )}

      <DestructiveConfirmationDialog
        open={bulkDeleteConfirm}
        onOpenChange={setBulkDeleteConfirm}
        title={`Delete ${selectedIds.size} game${selectedIds.size !== 1 ? 's' : ''}?`}
        description={`This will also delete ${selectedCascadeCounts.characterCount} character${selectedCascadeCounts.characterCount !== 1 ? 's' : ''} and ${selectedCascadeCounts.comboCount} combo${selectedCascadeCounts.comboCount !== 1 ? 's' : ''}. This action cannot be undone.`}
        actionLabel={`Delete Selected (${selectedIds.size})`}
        onConfirm={async () => {
          const selectedGames = games.filter((game) =>
            selectedIds.has(game.id),
          );
          const deleted =
            await deleteState.handleBulkDeleteGames(selectedGames);
          if (deleted) {
            setBulkDeleteConfirm(false);
            setSelectedIds(new Set());
            setIsSelecting(false);
          }
        }}
      />
    </div>
  );
}
