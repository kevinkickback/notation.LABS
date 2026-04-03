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
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { useAppStore } from '@/lib/store';
import { useSettings } from '@/hooks/useSettings';
import { SelectionToolbar } from '@/components/shared/SelectionToolbar';
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
	const [isSelecting, setIsSelecting] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

	// Initialize all hooks
	const filters = useGameFilters();
	const viewMode = useGameViewMode(settings.gameCardSize);
	const deleteState = useGameDelete();
	const operations = useGameOperations();

	// Read stats inputs in one reactive transaction to reduce query churn.
	const gameStatsData = useLiveQuery(indexedDbStorage.gameStats.getInputs, []);
	const characters = gameStatsData?.characters;
	const combos = gameStatsData?.combos;

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
			setSelectedIds((prev) => {
				if (!prev.has(game.id)) return prev;
				const next = new Set(prev);
				next.delete(game.id);
				return next;
			});
		}
	};

	// Handle confirmed delete
	const handleConfirmedDelete = async () => {
		if (deleteState.deleteTarget) {
			const deletedId = deleteState.deleteTarget.id;
			await deleteState.handleDeleteGame(deleteState.deleteTarget);
			setSelectedIds((prev) => {
				if (!prev.has(deletedId)) return prev;
				const next = new Set(prev);
				next.delete(deletedId);
				return next;
			});
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
		for (const id of selectedIds) {
			const game = games.find((g) => g.id === id);
			if (game) {
				await deleteState.handleDeleteGame(game);
			}
		}
		setSelectedIds(new Set());
		setIsSelecting(false);
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
				<GameLibraryToolbar
					viewMode={viewMode.viewMode}
					cardSize={viewMode.cardSize}
					showFilters={filters.showFilters}
					activeFilterCount={filters.activeFilterCount}
					isSelecting={isSelecting}
					onViewModeChange={viewMode.setViewMode}
					onCardSizeChange={viewMode.handleCardSizeChange}
					onToggleFilters={() => filters.toggleFilters()}
					onToggleSelect={() => {
						setIsSelecting((prev) => {
							if (prev) {
								setSelectedIds(new Set());
							}
							return !prev;
						});
					}}
					onAddGame={() => operations.openAddDialog()}
				/>
			</div>

			{isSelecting && (
				<SelectionToolbar
					selectedCount={selectedIds.size}
					onSelectAll={() =>
						setSelectedIds(new Set(filteredAndSorted.map((g) => g.id)))
					}
					onDeselectAll={() => setSelectedIds(new Set())}
					onDelete={() => {
						void handleBulkDelete();
					}}
				/>
			)}

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
							isSelecting={isSelecting}
							isSelected={selectedIds.has(game.id)}
							onSelect={() => handleGameSelect(game.id)}
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
							isSelecting={isSelecting}
							isSelected={selectedIds.has(game.id)}
							onSelect={() => handleGameSelect(game.id)}
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

			<AlertDialog
				open={bulkDeleteConfirm}
				onOpenChange={setBulkDeleteConfirm}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete {selectedIds.size} game{selectedIds.size !== 1 ? 's' : ''}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This will also delete {selectedCascadeCounts.characterCount} character
							{selectedCascadeCounts.characterCount !== 1 ? 's' : ''} and{' '}
							{selectedCascadeCounts.comboCount} combo
							{selectedCascadeCounts.comboCount !== 1 ? 's' : ''}. This action cannot be
							undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={async () => {
								for (const id of selectedIds) {
									const game = games.find((g) => g.id === id);
									if (game) {
										await deleteState.handleDeleteGame(game);
									}
								}
								setBulkDeleteConfirm(false);
								setSelectedIds(new Set());
								setIsSelecting(false);
							}}
						>
							Delete Selected ({selectedIds.size})
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
