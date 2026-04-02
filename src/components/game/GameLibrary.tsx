import type { Game } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
	Plus,
	GameController,
	Funnel,
	X,
	Trash,
	PencilSimple,
	Timer,
	User,
	SquaresFour,
	List,
} from '@phosphor-icons/react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { removeNotesOverride } from '@/hooks/useNotesOverride';
import defaultGameImage from '@/assets/images/defaultGame.jpg';
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
import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { indexedDbStorage, db } from '@/lib/storage/indexedDbStorage';
import { useAppStore } from '@/lib/store';
import { useSettings } from '@/hooks/useSettings';
import { toast } from 'sonner';
import { GameFormDialog } from './GameFormDialog';


type GameSort = 'name-asc' | 'name-desc' | 'characters' | 'combos' | 'modified';

interface GameLibraryProps {
	games: Game[];
}

export function GameLibrary({ games }: GameLibraryProps) {
	const isMobile = useIsMobile();
	const [gameDialogOpen, setGameDialogOpen] = useState(false);
	const [editingGame, setEditingGame] = useState<Game | null>(null);
	const { setSelectedGame } = useAppStore();

	const [showFilters, setShowFilters] = useState(false);
	const [sortBy, setSortBy] = useState<GameSort>('name-asc');
	const [filterSearch, setFilterSearch] = useState('');
	const [deleteTarget, setDeleteTarget] = useState<Game | null>(null);
	const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
	const settings = useSettings();
	const [cardSize, setCardSize] = useState(settings.gameCardSize);
	useEffect(() => {
		setCardSize(settings.gameCardSize);
	}, [settings.gameCardSize]);
	// Get character and combo counts per game
	const characters = useLiveQuery(() => db.characters.toArray(), []);
	const combos = useLiveQuery(() => db.combos.toArray(), []);

	const charCountByGame = useMemo(() => {
		const map: Record<string, number> = {};
		for (const c of characters || []) {
			map[c.gameId] = (map[c.gameId] || 0) + 1;
		}
		return map;
	}, [characters]);

	const comboCountByGame = useMemo(() => {
		const charToGame: Record<string, string> = {};
		for (const c of characters || []) {
			charToGame[c.id] = c.gameId;
		}
		const map: Record<string, number> = {};
		for (const combo of combos || []) {
			const gameId = charToGame[combo.characterId];
			if (gameId) map[gameId] = (map[gameId] || 0) + 1;
		}
		return map;
	}, [characters, combos]);

	const lastModifiedByGame = useMemo(() => {
		const charToGame: Record<string, string> = {};
		for (const c of characters || []) {
			charToGame[c.id] = c.gameId;
		}
		const map: Record<string, number> = {};
		for (const g of games) {
			map[g.id] = g.updatedAt;
		}
		for (const c of characters || []) {
			if (c.updatedAt > (map[c.gameId] || 0)) map[c.gameId] = c.updatedAt;
		}
		for (const combo of combos || []) {
			const gameId = charToGame[combo.characterId];
			if (gameId && combo.updatedAt > (map[gameId] || 0))
				map[gameId] = combo.updatedAt;
		}
		return map;
	}, [games, characters, combos]);

	const filteredAndSorted = useMemo(() => {
		let result = [...games];
		if (filterSearch) {
			const q = filterSearch.toLowerCase();
			result = result.filter((g) => g.name.toLowerCase().includes(q));
		}
		result.sort((a, b) => {
			switch (sortBy) {
				case 'name-asc':
					return a.name.localeCompare(b.name);
				case 'name-desc':
					return b.name.localeCompare(a.name);
				case 'characters':
					return (charCountByGame[b.id] || 0) - (charCountByGame[a.id] || 0);
				case 'combos':
					return (comboCountByGame[b.id] || 0) - (comboCountByGame[a.id] || 0);
				case 'modified':
					return (
						(lastModifiedByGame[b.id] || 0) - (lastModifiedByGame[a.id] || 0)
					);
				default:
					return 0;
			}
		});
		return result;
	}, [
		games,
		sortBy,
		filterSearch,
		charCountByGame,
		comboCountByGame,
		lastModifiedByGame,
	]);

	const hasActiveFilters = filterSearch !== '' || sortBy !== 'name-asc';
	const activeFilterCount =
		(filterSearch !== '' ? 1 : 0) + (sortBy !== 'name-asc' ? 1 : 0);

	const openEditDialog = (game: Game) => {
		setEditingGame(game);
		setGameDialogOpen(true);
	};

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

	if (games.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
				<div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
					<GameController className="w-12 h-12 text-primary" />
				</div>

				<div className="text-center max-w-md">
					<h2 className="text-3xl font-bold mb-2">No Games Yet</h2>
					<p className="text-muted-foreground mb-6">
						Start tracking combos by adding your first fighting game
					</p>
					<Button
						onClick={() => { setEditingGame(null); setGameDialogOpen(true); }}
						size="lg"
						className="gap-2"
					>
						<Plus weight="bold" />
						Add Your First Game
					</Button>
				</div>

				<GameFormDialog
					open={gameDialogOpen}
					onOpenChange={setGameDialogOpen}
					editingGame={editingGame}
				/>
			</div>
		);
	}

	return (
		<div>
			<div className="flex flex-wrap items-center justify-between gap-2 mb-8 min-w-0 w-full">
				<div className="min-w-0">
					<h2 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3 truncate">
						Game Library
						<span className="inline-flex items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold px-2.5 py-0.5 tabular-nums">
							{games.length}
						</span>
					</h2>
					<p className="text-muted-foreground truncate">
						Select a game to manage characters and combos
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2 min-w-0 w-full sm:w-auto">
					<div
						className={`flex items-center gap-1.5 bg-muted rounded-md px-2.5 h-9 ${viewMode === 'list' ? 'opacity-60 pointer-events-none' : ''}`}
						title={viewMode === 'list' ? 'Only available in grid view' : 'Card size'}
					>
						<span className="text-xs text-muted-foreground select-none">Size</span>
						<Slider
							min={120}
							max={300}
							step={10}
							value={[cardSize]}
							onValueChange={([v]) => {
								setCardSize(v);
								indexedDbStorage.settings
									.update({ gameCardSize: v });
							}}
							className="w-24"
							disabled={viewMode === 'list'}
						/>
					</div>
					<div className="flex items-center bg-muted rounded-md">
						<Button
							variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
							className="h-9 px-2 rounded-r-none flex items-center gap-1.5"
							onClick={() => setViewMode('grid')}
							title="Grid view"
						>
							<SquaresFour className="w-5 h-5" />
							<span className="text-xs leading-tight">Grid</span>
						</Button>
						<Button
							variant={viewMode === 'list' ? 'secondary' : 'ghost'}
							className="h-9 px-2 rounded-l-none flex items-center gap-1.5"
							onClick={() => setViewMode('list')}
							title="List view"
						>
							<List className="w-5 h-5" />
							<span className="text-xs leading-tight">List</span>
						</Button>
					</div>
					<div className="bg-muted rounded-md">
						<Button
							variant={showFilters ? 'secondary' : 'ghost'}
							onClick={() => setShowFilters(!showFilters)}
							title="Sort & Filter"
							className="relative flex items-center gap-1.5"
						>
							<Funnel className="w-5 h-5" />
							<span className="text-xs leading-tight">Filter</span>
							{activeFilterCount > 0 && (
								<span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] bg-primary text-primary-foreground rounded-full text-[10px] font-bold flex items-center justify-center leading-none px-0.5">
									{activeFilterCount}
								</span>
							)}
						</Button>
					</div>
					<Button onClick={() => { setEditingGame(null); setGameDialogOpen(true); }} className="gap-2">
						<Plus weight="bold" />
						Add Game
					</Button>
				</div>
			</div>

			{showFilters && (
				<div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-card border border-border rounded-lg">
					<Input
						placeholder="Search games..."
						value={filterSearch}
						onChange={(e) => setFilterSearch(e.target.value)}
						className="w-48"
					/>
					<Select
						value={sortBy}
						onValueChange={(v) => setSortBy(v as GameSort)}
					>
						<SelectTrigger className="w-44">
							<SelectValue placeholder="Sort by" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="name-asc">Name A–Z</SelectItem>
							<SelectItem value="name-desc">Name Z–A</SelectItem>
							<SelectItem value="characters">Most Characters</SelectItem>
							<SelectItem value="combos">Most Combos</SelectItem>
							<SelectItem value="modified">Last Modified</SelectItem>
						</SelectContent>
					</Select>
					{hasActiveFilters && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								setFilterSearch('');
								setSortBy('name-asc');
							}}
							className="gap-1"
						>
							<X className="w-4 h-4" />
							Clear
						</Button>
					)}
					{filterSearch && (
						<span className="text-sm text-muted-foreground ml-auto">
							{filteredAndSorted.length} of {games.length} games
						</span>
					)}
				</div>
			)}

			<div
				className={viewMode === 'list' ? 'flex flex-col gap-3' : 'grid gap-4'}
				style={
					viewMode === 'grid'
						? {
							gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`,
						}
						: undefined
				}
			>
				{filteredAndSorted.map((game) =>
					viewMode === 'grid' ? (
						<Card
							key={game.id}
							className="group cursor-pointer hover:shadow-lg transition-all border-2 hover:border-primary overflow-hidden relative aspect-[3/4] !py-0 !gap-0 hover:scale-[1.03]"
							onClick={() => setSelectedGame(game.id)}
						>
							<div
								className="absolute inset-0"
								style={{
									backgroundImage: `url(${game.logoImage || defaultGameImage})`,
									backgroundSize: game.coverZoom
										? `${game.coverZoom}%`
										: 'cover',
									backgroundPosition: game.coverZoom
										? `${game.coverPanX ?? 50}% ${game.coverPanY ?? 50}%`
										: 'center',
									backgroundRepeat: 'no-repeat',
								}}
							/>
							<CardContent className="p-0 relative z-10 flex flex-col justify-end h-full">
								<div
									className="p-3 pt-16"
									style={{
										background:
											'linear-gradient(to top, black 0%, rgba(0,0,0,0.95) 20%, rgba(0,0,0,0.75) 50%, rgba(0,0,0,0.35) 75%, transparent 100%)',
									}}
								>
									<h3
										className="font-bold text-white leading-tight mb-1"
										style={{
											fontSize: 'clamp(0.875rem, 1.1rem, 1.25rem)',
											display: '-webkit-box',
											WebkitLineClamp: 2,
											WebkitBoxOrient: 'vertical',
											overflow: 'hidden',
										}}
									>
										{game.name}
									</h3>
									<div className="flex items-center gap-3 text-sm text-gray-300">
										<span className="flex items-center gap-1">
											<User className="w-3.5 h-3.5" />{' '}
											{charCountByGame[game.id] || 0} characters
										</span>
									</div>
								</div>
								<div className={`absolute top-1.5 right-1.5 flex gap-1 transition-opacity z-20 ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7 text-blue-200 bg-blue-900/70 hover:text-white hover:!bg-blue-600 cursor-pointer"
										onClick={(e) => {
											e.stopPropagation();
											openEditDialog(game);
										}}
									>
										<PencilSimple className="w-4 h-4" weight="bold" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7 text-red-200 bg-red-900/70 hover:text-white hover:!bg-red-600 cursor-pointer"
										onClick={(e) => {
											e.stopPropagation();
											if (settings.confirmBeforeDelete) {
												setDeleteTarget(game);
											} else {
												handleDeleteGame(game);
											}
										}}
									>
										<Trash className="w-4 h-4" weight="bold" />
									</Button>
								</div>
							</CardContent>
						</Card>
					) : (
						<Card
							key={game.id}
							className="group cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary overflow-hidden h-[72px] !py-0 !gap-0"
							onClick={() => setSelectedGame(game.id)}
						>
							<CardContent className={`p-0 flex items-center h-full${isMobile && viewMode === 'list' ? ' relative' : ''}`}>
								<div
									className={`flex items-center flex-1 pl-4 ${isMobile && viewMode === 'list' ? 'gap-2 pr-16' : 'gap-6 pr-2'}`}
									style={isMobile && viewMode === 'list' ? { minWidth: 0 } : undefined}
								>
									<h3 className="font-bold text-white text-base min-w-[120px] truncate max-w-[40vw]">
										{game.name}
									</h3>
									{/* Responsive details: hide if not enough space */}
									{!isMobile || viewMode !== 'list' ? (
										<>
											<p className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
												<User className="w-3.5 h-3.5" />{' '}
												{charCountByGame[game.id] || 0} characters
											</p>
											<p className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
												<GameController className="w-3.5 h-3.5" />{' '}
												{comboCountByGame[game.id] || 0} combos
											</p>
											<p className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
												<Timer className="w-3.5 h-3.5" />{' '}
												{new Date(
													lastModifiedByGame[game.id] || game.updatedAt,
												).toLocaleDateString(undefined, {
													month: 'short',
													day: 'numeric',
													year: 'numeric',
												})}
											</p>
										</>
									) : (
										<>
											{/* On mobile list view, only show details if enough space (hide if name is long) */}
											{game.name.length < 16 && (
												<>
													<p className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0 max-w-[22vw] truncate">
														<User className="w-3.5 h-3.5" />{' '}
														{charCountByGame[game.id] || 0}
													</p>
													{game.name.length < 10 && (
														<>
															<p className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0 max-w-[22vw] truncate">
																<GameController className="w-3.5 h-3.5" />{' '}
																{comboCountByGame[game.id] || 0}
															</p>
															{game.name.length < 8 && (
																<p className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0 max-w-[22vw] truncate">
																	<Timer className="w-3.5 h-3.5" />{' '}
																	{new Date(
																		lastModifiedByGame[game.id] || game.updatedAt,
																	).toLocaleDateString(undefined, {
																		month: 'short',
																		day: 'numeric',
																		year: 'numeric',
																	})}
																</p>
															)}
														</>
													)}
												</>
											)}
										</>
									)}
								</div>
								<div
									className={`flex gap-1 pr-3 ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 transition-opacity'} ${isMobile && viewMode === 'list' ? 'absolute right-2 top-1/2 -translate-y-1/2 z-10' : ''}`}
									style={isMobile && viewMode === 'list' ? { height: 'auto', background: 'none' } : undefined}
								>
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7 text-blue-200 bg-blue-900/70 hover:text-white hover:!bg-blue-600"
										onClick={(e) => {
											e.stopPropagation();
											openEditDialog(game);
										}}
									>
										<PencilSimple className="w-4 h-4" weight="bold" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7 text-red-200 bg-red-900/70 hover:text-white hover:!bg-red-600"
										onClick={(e) => {
											e.stopPropagation();
											if (settings.confirmBeforeDelete) {
												setDeleteTarget(game);
											} else {
												handleDeleteGame(game);
											}
										}}
									>
										<Trash className="w-4 h-4" weight="bold" />
									</Button>
								</div>
							</CardContent>
						</Card>
					),
				)}
			</div>

			<GameFormDialog
				open={gameDialogOpen}
				onOpenChange={setGameDialogOpen}
				editingGame={editingGame}
			/>

			{settings.confirmBeforeDelete && (
				<AlertDialog
					open={!!deleteTarget}
					onOpenChange={(open) => !open && setDeleteTarget(null)}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
							<AlertDialogDescription>
								{(() => {
									if (!deleteTarget) return '';
									const charCount = charCountByGame[deleteTarget.id] || 0;
									const comboCount = comboCountByGame[deleteTarget.id] || 0;
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
								onClick={() => deleteTarget && handleDeleteGame(deleteTarget)}
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
