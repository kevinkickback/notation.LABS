import type { Game, Character } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
	Plus,
	User,
	Funnel,
	Trash,
	PencilSimple,
	Timer,
	GameController,
	SquaresFour,
	List,
	Note,
	CaretDown,
	Palette,
	X,
	CheckSquare,
} from '@phosphor-icons/react';
import { useIsMobile } from '@/hooks/useIsMobile';
import defaultCharacterImage from '@/assets/images/defaultCharacter.jpg';
import defaultGameImage from '@/assets/images/defaultGame.jpg';
import { CharacterFormDialog } from './CharacterFormDialog';
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
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { indexedDbStorage, db } from '@/lib/storage/indexedDbStorage';
import { useAppStore } from '@/lib/store';
import { useSettings } from '@/hooks/useSettings';
import { useNotesOverride } from '@/hooks/useNotesOverride';
import { toast } from 'sonner';
import { ButtonColorDialog } from '@/components/shared/ButtonColorDialog';
import { SelectionToolbar } from '@/components/shared/SelectionToolbar';

type CharacterSort = 'name-asc' | 'name-desc' | 'combos' | 'modified';

const clampCharSize = (v: number) => Math.min(300, Math.max(120, v));

interface CharacterViewProps {
	game: Game;
	characters: Character[];
}

export function CharacterView({ game, characters }: CharacterViewProps) {
	const isMobile = useIsMobile();
	const { setSelectedCharacter } = useAppStore();

	const [charDialogOpen, setCharDialogOpen] = useState(false);
	const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
	const [colorDialogOpen, setColorDialogOpen] = useState(false);

	const [showFilters, setShowFilters] = useState(false);
	const [sortBy, setSortBy] = useState<CharacterSort>('name-asc');
	const [filterSearch, setFilterSearch] = useState('');
	const [deleteTarget, setDeleteTarget] = useState<Character | null>(null);
	const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
	const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
	const [isSelecting, setIsSelecting] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const settings = useSettings();
	const [cardSize, setCardSize] = useState(() =>
		clampCharSize(settings.characterCardSize),
	);
	useEffect(() => {
		setCardSize(clampCharSize(settings.characterCardSize));
	}, [settings.characterCardSize]);

	const [showNotes, handleToggleNotes] = useNotesOverride(
		game.id,
		settings.notesDefaultOpen ?? false,
	);

	// Get combo counts per character
	const combos = useLiveQuery(
		() =>
			db.combos
				.where('characterId')
				.anyOf(characters.map((c) => c.id))
				.toArray(),
		[characters],
	);

	const comboCountByChar = useMemo(() => {
		const map: Record<string, number> = {};
		for (const combo of combos || []) {
			map[combo.characterId] = (map[combo.characterId] || 0) + 1;
		}
		return map;
	}, [combos]);

	const lastModifiedByChar = useMemo(() => {
		const map: Record<string, number> = {};
		for (const c of characters) {
			map[c.id] = c.updatedAt;
		}
		for (const combo of combos || []) {
			if (combo.updatedAt > (map[combo.characterId] || 0)) {
				map[combo.characterId] = combo.updatedAt;
			}
		}
		return map;
	}, [characters, combos]);

	const filteredAndSorted = useMemo(() => {
		let result = [...characters];
		if (filterSearch) {
			const q = filterSearch.toLowerCase();
			result = result.filter((c) => c.name.toLowerCase().includes(q));
		}
		result.sort((a, b) => {
			switch (sortBy) {
				case 'name-asc':
					return a.name.localeCompare(b.name);
				case 'name-desc':
					return b.name.localeCompare(a.name);
				case 'combos':
					return (comboCountByChar[b.id] || 0) - (comboCountByChar[a.id] || 0);
				case 'modified':
					return (
						(lastModifiedByChar[b.id] || 0) - (lastModifiedByChar[a.id] || 0)
					);
				default:
					return 0;
			}
		});
		return result;
	}, [characters, sortBy, filterSearch, comboCountByChar, lastModifiedByChar]);

	const hasActiveFilters = filterSearch !== '' || sortBy !== 'name-asc';
	const activeFilterCount =
		(filterSearch !== '' ? 1 : 0) + (sortBy !== 'name-asc' ? 1 : 0);

	const handleDeleteCharacter = async (character: Character) => {
		try {
			await indexedDbStorage.characters.delete(character.id);
			setSelectedIds((prev) => {
				if (!prev.has(character.id)) return prev;
				const next = new Set(prev);
				next.delete(character.id);
				return next;
			});
			toast.success(`"${character.name}" deleted`);
			setDeleteTarget(null);
		} catch {
			toast.error('Failed to delete character');
		}
	};

	const openEditDialog = (character: Character) => {
		setEditingCharacter(character);
		setCharDialogOpen(true);
	};

	const handleCharacterSelect = (characterId: string) => {
		if (!isSelecting) {
			setSelectedCharacter(characterId);
			return;
		}
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(characterId)) next.delete(characterId);
			else next.add(characterId);
			return next;
		});
	};

	const selectedComboCount = useMemo(() => {
		let comboCount = 0;
		for (const id of selectedIds) {
			comboCount += comboCountByChar[id] || 0;
		}
		return comboCount;
	}, [selectedIds, comboCountByChar]);

	const handleBulkDelete = async () => {
		if (selectedIds.size === 0) return;
		if (settings.confirmBeforeDelete) {
			setBulkDeleteConfirm(true);
			return;
		}
		for (const id of selectedIds) {
			const character = characters.find((c) => c.id === id);
			if (character) {
				await handleDeleteCharacter(character);
			}
		}
		setSelectedIds(new Set());
		setIsSelecting(false);
	};

	if (characters.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
				<div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center">
					<User className="w-12 h-12 text-accent" />
				</div>

				<div className="text-center max-w-md">
					<div
						className="w-20 h-28 rounded-xl mx-auto mb-4 border-2 border-border overflow-hidden"
						style={{
							backgroundImage: `url(${game.logoImage || defaultGameImage})`,
							backgroundSize: game.coverZoom ? `${game.coverZoom}%` : 'cover',
							backgroundPosition: game.coverZoom ? `${game.coverPanX ?? 50}% ${game.coverPanY ?? 50}%` : 'center',
							backgroundRepeat: 'no-repeat',
						}}
					/>
					<h2 className="text-3xl font-bold mb-2">{game.name}</h2>
					<p className="text-muted-foreground mb-6">
						No characters added yet. Add your first character to start tracking
						combos.
					</p>
					<Button
						onClick={() => { setEditingCharacter(null); setCharDialogOpen(true); }}
						size="lg"
						className="gap-2"
					>
						<Plus weight="bold" />
						Add Character
					</Button>
				</div>

				<CharacterFormDialog
					open={charDialogOpen}
					onOpenChange={setCharDialogOpen}
					editingCharacter={editingCharacter}
					game={game}
				/>
			</div>
		);
	}

	return (
		<div>
			<div className="flex flex-wrap items-center justify-between gap-4 mb-8 min-w-0">
				<div className="min-w-0 flex-1 flex items-center gap-4">
					<div
						className="w-12 h-16 rounded-lg shrink-0 border border-border overflow-hidden"
						style={{
							backgroundImage: `url(${game.logoImage || defaultGameImage})`,
							backgroundSize: game.coverZoom ? `${game.coverZoom}%` : 'cover',
							backgroundPosition: game.coverZoom ? `${game.coverPanX ?? 50}% ${game.coverPanY ?? 50}%` : 'center',
							backgroundRepeat: 'no-repeat',
						}}
					/>
					<div className="min-w-0">
						<h2 className="text-3xl font-bold mb-1 truncate">{game.name}</h2>
						<p className="text-muted-foreground">
							Select a character to manage combos
						</p>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2 min-w-0">
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
								indexedDbStorage.settings.update({ characterCardSize: v });
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
					<div className="bg-muted rounded-md">
						<Button
							variant={isSelecting ? 'secondary' : 'ghost'}
							onClick={() => {
								setIsSelecting((prev) => {
									if (prev) {
										setSelectedIds(new Set());
									}
									return !prev;
								});
							}}
							title="Multi-select characters"
							className="flex items-center gap-1.5"
						>
							<CheckSquare className="w-5 h-5" />
							<span className="text-xs leading-tight">Select</span>
						</Button>
					</div>
					<div className="bg-muted rounded-md">
						<Button
							variant="ghost"
							onClick={() => setColorDialogOpen(true)}
							title="Edit button colors"
							className="flex items-center gap-1.5"
						>
							<Palette className="w-5 h-5" />
							<span className="text-xs leading-tight">Colors</span>
						</Button>
					</div>
					<Button onClick={() => { setEditingCharacter(null); setCharDialogOpen(true); }} className="gap-2">
						<Plus weight="bold" />
						Add Character
					</Button>
				</div>
			</div>

			{game.notes?.trim() && (
				<div className="mb-6 border border-border rounded-lg overflow-hidden">
					<button
						type="button"
						onClick={handleToggleNotes}
						className="w-full flex items-center justify-between px-4 py-2.5 bg-card hover:bg-muted/50 transition-colors"
					>
						<span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
							<Note className="w-4 h-4" />
							Notes
						</span>
						<CaretDown
							className={`w-4 h-4 text-muted-foreground transition-transform duration-150 ${showNotes ? 'rotate-180' : ''}`}
						/>
					</button>
					{showNotes && (
						<div className="px-4 py-3 bg-card border-t border-border">
							<p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
								{game.notes}
							</p>
						</div>
					)}
				</div>
			)}

			{showFilters && (
				<div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-card border border-border rounded-lg">
					<Input
						placeholder="Search characters..."
						value={filterSearch}
						onChange={(e) => setFilterSearch(e.target.value)}
						className="w-48"
					/>
					<Select
						value={sortBy}
						onValueChange={(v) => setSortBy(v as CharacterSort)}
					>
						<SelectTrigger className="w-44">
							<SelectValue placeholder="Sort by" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="name-asc">Name A–Z</SelectItem>
							<SelectItem value="name-desc">Name Z–A</SelectItem>
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
							{filteredAndSorted.length} of {characters.length} characters
						</span>
					)}
				</div>
			)}

			{isSelecting && (
				<SelectionToolbar
					selectedCount={selectedIds.size}
					onSelectAll={() =>
						setSelectedIds(new Set(filteredAndSorted.map((c) => c.id)))
					}
					onDeselectAll={() => setSelectedIds(new Set())}
					onDelete={() => {
						void handleBulkDelete();
					}}
				/>
			)}

			<div
				className={viewMode === 'list' ? 'flex flex-col gap-3' : 'grid gap-4'}
				style={
					viewMode === 'grid'
						? {
							gridTemplateColumns: `repeat(auto-fill, minmax(${Math.round((cardSize * 4) / 3)}px, 1fr))`,
						}
						: undefined
				}
			>
				{filteredAndSorted.map((character) =>
					viewMode === 'grid' ? (
						<Card
							key={character.id}
							className={`group cursor-pointer hover:shadow-lg transition-all border-2 hover:border-accent overflow-hidden relative aspect-[4/3] !py-0 !gap-0 hover:scale-[1.03] ${selectedIds.has(character.id) ? 'ring-2 ring-primary' : ''}`}
							onClick={() => handleCharacterSelect(character.id)}
						>
							{isSelecting && (
								<div className="absolute top-2 left-2 z-30">
									<input
										type="checkbox"
										checked={selectedIds.has(character.id)}
										onChange={() => handleCharacterSelect(character.id)}
										onClick={(e) => e.stopPropagation()}
										className="w-4 h-4 accent-primary cursor-pointer"
									/>
								</div>
							)}
							<div
								className="absolute inset-0"
								style={{
									backgroundImage: `url(${character.portraitImage || defaultCharacterImage})`,
									backgroundSize: character.portraitZoom
										? `${character.portraitZoom}%`
										: 'cover',
									backgroundPosition: character.portraitZoom
										? `${character.portraitPanX ?? 50}% ${character.portraitPanY ?? 50}%`
										: 'center',
									backgroundRepeat: 'no-repeat',
								}}
							/>
							<CardContent className="p-0 relative z-10 flex flex-col justify-end h-full">
								<div
									className="p-3 pt-16"
									style={{
										background:
											'linear-gradient(to top, black 0%, rgba(0,0,0,0.97) 25%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.2) 85%, transparent 100%)',
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
										{character.name}
									</h3>
									<div className="flex items-center gap-3 text-sm text-gray-300">
										<span className="flex items-center gap-1">
											<GameController className="w-3.5 h-3.5" />{' '}
											{comboCountByChar[character.id] || 0} combos
										</span>
									</div>
								</div>
								{!isSelecting && (
									<div className={`absolute top-1.5 right-1.5 flex gap-1 transition-opacity z-20 ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7 text-blue-200 bg-blue-900/70 hover:text-white hover:!bg-blue-600 cursor-pointer"
											onClick={(e) => {
												e.stopPropagation();
												openEditDialog(character);
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
													setDeleteTarget(character);
												} else {
													handleDeleteCharacter(character);
												}
											}}
										>
											<Trash className="w-4 h-4" weight="bold" />
										</Button>
									</div>
								)}
							</CardContent>
						</Card>
					) : (
						<Card
							key={character.id}
							className={`group cursor-pointer hover:shadow-lg transition-all border-2 hover:border-accent overflow-hidden h-[72px] !py-0 !gap-0 ${selectedIds.has(character.id) ? 'ring-2 ring-primary' : ''}`}
							onClick={() => handleCharacterSelect(character.id)}
						>
							<CardContent className={`p-0 flex items-center h-full${isMobile && viewMode === 'list' ? ' relative' : ''}`}>
								{isSelecting && (
									<div className="pl-3 shrink-0">
										<input
											type="checkbox"
											checked={selectedIds.has(character.id)}
											onChange={() => handleCharacterSelect(character.id)}
											onClick={(e) => e.stopPropagation()}
											className="w-4 h-4 accent-primary cursor-pointer"
										/>
									</div>
								)}
								<div
									className={`flex items-center flex-1 ${isSelecting ? 'pl-2' : 'pl-4'} ${isMobile && viewMode === 'list' ? 'gap-2 pr-16' : 'gap-6 pr-2'}`}
									style={isMobile && viewMode === 'list' ? { minWidth: 0 } : undefined}
								>
									<h3 className="font-bold text-white text-base min-w-[120px] truncate max-w-[40vw]">
										{character.name}
									</h3>
									{/* Responsive details: hide if not enough space */}
									{!isMobile || viewMode !== 'list' ? (
										<>
											<p className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
												<GameController className="w-3.5 h-3.5" />{' '}
												{comboCountByChar[character.id] || 0} combos
											</p>
											<p className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
												<Timer className="w-3.5 h-3.5" />{' '}
												{new Date(
													lastModifiedByChar[character.id] || character.updatedAt,
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
											{character.name.length < 16 && (
												<p className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0 max-w-[22vw] truncate">
													<GameController className="w-3.5 h-3.5" />{' '}
													{comboCountByChar[character.id] || 0}
												</p>
											)}
											{character.name.length < 10 && (
												<p className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0 max-w-[22vw] truncate">
													<Timer className="w-3.5 h-3.5" />{' '}
													{new Date(
														lastModifiedByChar[character.id] || character.updatedAt,
													).toLocaleDateString(undefined, {
														month: 'short',
														day: 'numeric',
														year: 'numeric',
													})}
												</p>
											)}
										</>
									)}
								</div>
								{!isSelecting && (
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
												openEditDialog(character);
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
													setDeleteTarget(character);
												} else {
													handleDeleteCharacter(character);
												}
											}}
										>
											<Trash className="w-4 h-4" weight="bold" />
										</Button>
									</div>
								)}
							</CardContent>
						</Card>
					),
				)}
			</div>

			<CharacterFormDialog
				open={charDialogOpen}
				onOpenChange={setCharDialogOpen}
				editingCharacter={editingCharacter}
				game={game}
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
									const comboCount = comboCountByChar[deleteTarget.id] || 0;
									if (comboCount === 0)
										return 'This character has no combos. This action cannot be undone.';
									return `This will also delete ${comboCount} combo${comboCount !== 1 ? 's' : ''}. This action cannot be undone.`;
								})()}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
								onClick={() =>
									deleteTarget && handleDeleteCharacter(deleteTarget)
								}
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
							Delete {selectedIds.size} character
							{selectedIds.size !== 1 ? 's' : ''}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This will also delete {selectedComboCount} combo
							{selectedComboCount !== 1 ? 's' : ''}. This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={async () => {
								for (const id of selectedIds) {
									const character = characters.find((c) => c.id === id);
									if (character) {
										await handleDeleteCharacter(character);
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

			<ButtonColorDialog
				open={colorDialogOpen}
				onOpenChange={setColorDialogOpen}
				game={game}
			/>
		</div>
	);
}
