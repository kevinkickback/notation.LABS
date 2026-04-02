import type { Game, GameSort } from '@/lib/types';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/storage/indexedDbStorage';
import { useAppStore } from '@/lib/store';
import { useSettings } from '@/hooks/useSettings';
import { GameFormDialog } from './GameFormDialog';
import { GameLibraryHeader } from './GameLibraryHeader';
import { GameLibraryToolbar } from './GameLibraryToolbar';
import { GameLibraryFilterPanel } from './GameLibraryFilterPanel';
import { GameLibraryEmptyState } from './GameLibraryEmptyState';
import { GameGridCard } from './GameGridCard';
import { GameListCard } from './GameListCard';
import { useGameFilters } from '@/hooks/useGameFilters';
import { useGameViewMode } from '@/hooks/useGameViewMode';
import { useGameStats } from '@/hooks/useGameStats';
import { useGameDelete } from '@/hooks/useGameDelete';
import { useGameOperations } from '@/hooks/useGameOperations';

interface GameLibraryProps {
	games: Game[];
}

export function GameLibrary({ games }: GameLibraryProps) {
	const isMobile = useIsMobile();
	const { setSelectedGame } = useAppStore();
	const settings = useSettings();

	// Initialize all hooks
	const filters = useGameFilters();
	const viewMode = useGameViewMode(settings.gameCardSize);
	const deleteState = useGameDelete();
	const operations = useGameOperations();

	// Get character and combo counts per game
	const characters = useLiveQuery(() => db.characters.toArray(), []);
	const combos = useLiveQuery(() => db.combos.toArray(), []);

	// Update stats with current characters and combos
	const stats = useGameStats(games, characters, combos);

	// Compute filtered and sorted games
	const filteredAndSorted = useMemo(() => {
		let result = [...games];
		if (filters.filterSearch) {
			const q = filters.filterSearch.toLowerCase();
			result = result.filter((g) => g.name.toLowerCase().includes(q));
		}
		result.sort((a, b) => {
			switch (filters.sortBy) {
				case 'name-asc':
					return a.name.localeCompare(b.name);
				case 'name-desc':
					return b.name.localeCompare(a.name);
				case 'characters':
					return (stats.charCountByGame[b.id] || 0) - (stats.charCountByGame[a.id] || 0);
				case 'combos':
					return (stats.comboCountByGame[b.id] || 0) - (stats.comboCountByGame[a.id] || 0);
				case 'modified':
					return (
						(stats.lastModifiedByGame[b.id] || 0) - (stats.lastModifiedByGame[a.id] || 0)
					);
				default:
					return 0;
			}
		});
		return result;
	}, [games, filters.sortBy, filters.filterSearch, stats.charCountByGame, stats.comboCountByGame, stats.lastModifiedByGame]);

	// Handle delete with optional confirmation
	const handleDelete = async (game: Game) => {
		if (settings.confirmBeforeDelete) {
			deleteState.setDeleteTarget(game);
		} else {
			await deleteState.handleDeleteGame(game);
		}
	};

	// Handle confirmed delete
	const handleConfirmedDelete = async () => {
		if (deleteState.deleteTarget) {
			await deleteState.handleDeleteGame(deleteState.deleteTarget);
		}
	};

	if (games.length === 0) {
		return <GameLibraryEmptyState onAddGame={() => operations.openAddDialog()} />;
	}

	return (
		<div>
			{/* Header */}
			<GameLibraryHeader gameCount={games.length} />

			{/* Toolbar */}
			<GameLibraryToolbar
				viewMode={viewMode.viewMode}
				cardSize={viewMode.cardSize}
				showFilters={filters.showFilters}
				activeFilterCount={filters.activeFilterCount}
				onViewModeChange={viewMode.setViewMode}
				onCardSizeChange={viewMode.handleCardSizeChange}
				onToggleFilters={() => filters.toggleFilters()}
				onAddGame={() => operations.openAddDialog()}
			/>

			{/* Filter Panel */}
			{filters.showFilters && (
				<GameLibraryFilterPanel
					filterSearch={filters.filterSearch}
					onFilterSearchChange={(value: string) => filters.setFilterSearch(value)}
					sortBy={filters.sortBy}
					onSortByChange={(value: GameSort) => filters.setSortBy(value)}
					hasActiveFilters={filters.hasActiveFilters}
					onClearFilters={() => filters.clearFilters()}
					filteredCount={filteredAndSorted.length}
					totalCount={games.length}
				/>
			)}

			{/* Games Grid/List */}
			<div
				className={viewMode.viewMode === 'list' ? 'flex flex-col gap-3' : 'grid gap-4'}
				style={
					viewMode.viewMode === 'grid'
						? {
							gridTemplateColumns: `repeat(auto-fill, minmax(${viewMode.cardSize}px, 1fr))`,
						}
						: undefined
				}
			>
				{filteredAndSorted.map((game) => (
					viewMode.viewMode === 'grid' ? (
						<GameGridCard
							key={game.id}
							game={game}
							charCount={stats.charCountByGame[game.id] || 0}
							isMobile={isMobile}
							onSelect={() => setSelectedGame(game.id)}
							onEdit={() => operations.openEditDialog(game)}
							onDelete={() => handleDelete(game)}
						/>
					) : (
						<GameListCard
							key={game.id}
							game={game}
							charCount={stats.charCountByGame[game.id] || 0}
							comboCount={stats.comboCountByGame[game.id] || 0}
							lastModified={stats.lastModifiedByGame[game.id] || game.updatedAt}
							isMobile={isMobile}
							onSelect={() => setSelectedGame(game.id)}
							onEdit={() => operations.openEditDialog(game)}
							onDelete={() => handleDelete(game)}
						/>
					)
				))}
			</div>

			{/* Dialogs */}
			<GameFormDialog
				open={operations.gameDialogOpen}
				onOpenChange={operations.setGameDialogOpen}
				editingGame={operations.editingGame}
			/>

			{settings.confirmBeforeDelete && (
				<AlertDialog
					open={!!deleteState.deleteTarget}
					onOpenChange={(open) => !open && deleteState.setDeleteTarget(null)}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Delete {deleteState.deleteTarget?.name}?</AlertDialogTitle>
							<AlertDialogDescription>
								{(() => {
									if (!deleteState.deleteTarget) return '';
									const charCount = stats.charCountByGame[deleteState.deleteTarget.id] || 0;
									const comboCount = stats.comboCountByGame[deleteState.deleteTarget.id] || 0;
									if (charCount === 0)
										return 'This game has no characters or combos. This action cannot be undone.';
									return `This will also delete ${charCount} character${charCount !== 1 ? 's' : ''} and ${comboCount} combo${comboCount !== 1 ? 's' : ''}. This action cannot be undone.`;
								})()}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
								onClick={handleConfirmedDelete}
							>
								Delete
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			)}
		</div>
	);
}
