import type { Game, Character, Combo, DisplayMode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import defaultCharacterImage from '@/assets/images/defaultCharacter.jpg';
import {
	Plus,
	Lightning,
	Funnel,
	CheckSquare,
	Trash,
	Warning,
	Note,
	CaretDown,
	Palette,
} from '@phosphor-icons/react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useNotesOverride } from '@/hooks/useNotesOverride';
import { indexedDbStorage, db } from '@/lib/storage/indexedDbStorage';
import { DisplayModeToggle } from '@/components/combo/DisplayModeToggle';
import { ComboFormDialog } from '@/components/combo/ComboFormDialog';
import { VideoPlayerDialog } from '@/components/combo/VideoPlayerDialog';
import { ComboFilters } from '@/components/combo/ComboFilters';
import { SortableComboCard } from '@/components/combo/SortableComboCard';
import { ButtonColorDialog } from '@/components/shared/ButtonColorDialog';
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogCancel,
	AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from '@dnd-kit/core';
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface ComboViewProps {
	game: Game;
	character: Character;
	combos: Combo[];
}

export function ComboView({ game, character, combos }: ComboViewProps) {
	const settings = useSettings();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingCombo, setEditingCombo] = useState<Combo | null>(null);
	const displayMode = settings.displayMode;

	// Video player state
	const [videoPlayerOpen, setVideoPlayerOpen] = useState(false);
	const [videoPlayerUrl, setVideoPlayerUrl] = useState<string | null>(null);
	const [videoPlayerTitle, setVideoPlayerTitle] = useState('');
	const [videoSize, setVideoSize] = useState<'sm' | 'md' | 'lg' | 'xl'>(
		settings.videoPlayerSize,
	);

	// Filter state
	const [showFilters, setShowFilters] = useState(false);
	const [filterTags, setFilterTags] = useState<string[]>([]);

	const [showNotes, handleToggleNotes] = useNotesOverride(
		character.id,
		settings.notesDefaultOpen ?? false,
	);

	const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
	const [filterOutdated, setFilterOutdated] = useState<
		'all' | 'outdated' | 'current'
	>('all');
	const [filterSearch, setFilterSearch] = useState('');

	// Multi-select state
	const [isSelecting, setIsSelecting] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	// Delete confirmation state
	const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
	const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

	// Button color editor state
	const [colorDialogOpen, setColorDialogOpen] = useState(false);

	// Sync video size from settings
	useEffect(() => {
		setVideoSize(settings.videoPlayerSize);
	}, [settings.videoPlayerSize]);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const allTags = useMemo(() => {
		const tagSet = new Set<string>();
		combos.forEach((c) => {
			c.tags.forEach((t) => {
				tagSet.add(t);
			});
		});
		return Array.from(tagSet).sort();
	}, [combos]);

	const filteredCombos = useMemo(() => {
		return combos.filter((combo) => {
			if (
				filterTags.length > 0 &&
				!filterTags.every((t) => combo.tags.includes(t))
			)
				return false;
			if (
				filterDifficulty !== 'all' &&
				combo.difficulty !== parseInt(filterDifficulty, 10)
			)
				return false;
			if (filterOutdated === 'outdated' && !combo.outdated) return false;
			if (filterOutdated === 'current' && combo.outdated) return false;
			if (filterSearch) {
				const q = filterSearch.toLowerCase();
				const matches =
					combo.name.toLowerCase().includes(q) ||
					combo.notation.toLowerCase().includes(q) ||
					combo.description?.toLowerCase().includes(q) ||
					combo.tags.some((t) => t.toLowerCase().includes(q));
				if (!matches) return false;
			}
			return true;
		});
	}, [combos, filterTags, filterDifficulty, filterOutdated, filterSearch]);

	const hasActiveFilters =
		filterTags.length > 0 ||
		filterDifficulty !== 'all' ||
		filterOutdated !== 'all' ||
		filterSearch !== '';
	const activeFilterCount = [
		filterTags.length > 0,
		filterDifficulty !== 'all',
		filterOutdated !== 'all',
		filterSearch !== '',
	].filter(Boolean).length;

	const handleDisplayModeChange = async (mode: DisplayMode) => {
		await indexedDbStorage.settings.update({ displayMode: mode });
	};

	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		const oldIndex = combos.findIndex((c) => c.id === active.id);
		const newIndex = combos.findIndex((c) => c.id === over.id);
		if (oldIndex === -1 || newIndex === -1) return;

		const reordered = arrayMove(combos, oldIndex, newIndex);
		await indexedDbStorage.combos.reorder(reordered.map((c) => c.id));
	};

	const clearFilters = () => {
		setFilterTags([]);
		setFilterDifficulty('all');
		setFilterOutdated('all');
		setFilterSearch('');
	};

	const toggleFilterTag = (tag: string) => {
		setFilterTags((prev) =>
			prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
		);
	};

	const handleTagClick = (tag: string) => {
		if (!showFilters) setShowFilters(true);
		if (!filterTags.includes(tag)) {
			setFilterTags((prev) => [...prev, tag]);
		}
	};

	const handleEdit = (combo: Combo) => {
		setEditingCombo(combo);
		setDialogOpen(true);
	};

	const handleDuplicate = async (combo: Combo) => {
		try {
			const { id, createdAt, updatedAt, sortOrder, ...rest } = combo;
			await indexedDbStorage.combos.add({
				...rest,
				name: `${combo.name} (copy)`,
				demoUrl: combo.demoUrl?.startsWith('local:')
					? ''
					: (combo.demoUrl ?? ''),
			});
			toast.success('Combo duplicated');
		} catch {
			toast.error('Failed to duplicate combo');
		}
	};

	const handleDelete = async (comboId: string) => {
		if (settings.confirmBeforeDelete) {
			setDeleteTarget(comboId);
			return;
		}
		await executeDelete(comboId);
	};

	const executeDelete = async (comboId: string) => {
		try {
			const combo = combos.find((c) => c.id === comboId);
			if (combo?.demoUrl?.startsWith('local:')) {
				await indexedDbStorage.demoVideos.delete(
					combo.demoUrl.replace('local:', ''),
				);
			}
			await indexedDbStorage.combos.delete(comboId);
			toast.success('Combo deleted');
		} catch {
			toast.error('Failed to delete combo');
		}
	};

	const toggleSelect = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const handleBulkDelete = () => {
		if (selectedIds.size === 0) return;
		if (settings.confirmBeforeDelete) {
			setBulkDeleteConfirm(true);
			return;
		}
		executeBulkDelete();
	};

	const handleBulkMarkOutdated = async (outdated: boolean) => {
		if (selectedIds.size === 0) return;
		try {
			await db.transaction('rw', db.combos, async () => {
				for (const id of selectedIds) {
					await indexedDbStorage.combos.update(id, {
						outdated: outdated || undefined,
					});
				}
			});
			toast.success(
				`${selectedIds.size} combo${selectedIds.size > 1 ? 's' : ''} marked as ${outdated ? 'outdated' : 'current'}`,
			);
			setSelectedIds(new Set());
			setIsSelecting(false);
		} catch {
			toast.error('Failed to update combos');
		}
	};

	const executeBulkDelete = async () => {
		try {
			await db.transaction('rw', [db.combos, db.demoVideos], async () => {
				for (const id of selectedIds) {
					const combo = combos.find((c) => c.id === id);
					if (combo?.demoUrl?.startsWith('local:')) {
						await indexedDbStorage.demoVideos.delete(
							combo.demoUrl.replace('local:', ''),
						);
					}
					await indexedDbStorage.combos.delete(id);
				}
			});
			toast.success(
				`${selectedIds.size} combo${selectedIds.size > 1 ? 's' : ''} deleted`,
			);
			setSelectedIds(new Set());
			setIsSelecting(false);
		} catch {
			toast.error('Failed to delete combos');
		}
	};

	const selectAll = () => {
		setSelectedIds(new Set(filteredCombos.map((c) => c.id)));
	};

	const deselectAll = () => {
		setSelectedIds(new Set());
	};

	const handleWatchDemo = useCallback(async (combo: Combo) => {
		if (!combo.demoUrl) return;
		if (combo.demoUrl.startsWith('local:')) {
			const videoId = combo.demoUrl.replace('local:', '');
			const blobUrl = await indexedDbStorage.demoVideos.getBlobUrl(videoId);
			if (blobUrl) {
				setVideoPlayerUrl(blobUrl);
				setVideoPlayerTitle(combo.name);
				setVideoPlayerOpen(true);
			} else {
				toast.error('Video file not found');
			}
		} else {
			setVideoPlayerUrl(combo.demoUrl);
			setVideoPlayerTitle(combo.name);
			setVideoPlayerOpen(true);
		}
	}, []);

	const closeVideoPlayer = useCallback(() => {
		setVideoPlayerOpen(false);
		if (videoPlayerUrl?.startsWith('blob:')) {
			URL.revokeObjectURL(videoPlayerUrl);
		}
		setVideoPlayerUrl(null);
		setVideoPlayerTitle('');
	}, [videoPlayerUrl]);

	const comboFormDialog = (
		<ComboFormDialog
			open={dialogOpen}
			onOpenChange={(open) => {
				setDialogOpen(open);
				if (!open) setEditingCombo(null);
			}}
			game={game}
			character={character}
			editingCombo={editingCombo}
			allTags={allTags}
		/>
	);

	if (combos.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
				<div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
					<Lightning className="w-12 h-12 text-primary" />
				</div>

				<div className="text-center max-w-md">
					<div
						className="w-32 h-24 rounded-xl mx-auto mb-4 border-2 border-border overflow-hidden"
						style={{
							backgroundImage: `url(${character.portraitImage || defaultCharacterImage})`,
							backgroundSize: character.portraitZoom ? `${character.portraitZoom}%` : 'cover',
							backgroundPosition: character.portraitZoom ? `${character.portraitPanX ?? 50}% ${character.portraitPanY ?? 50}%` : 'center',
							backgroundRepeat: 'no-repeat',
						}}
					/>
					<h2 className="text-3xl font-bold mb-2">{character.name}</h2>
					<p className="text-sm text-muted-foreground mb-6">{game.name}</p>
					<p className="text-muted-foreground mb-6">
						No combos yet. Add your first combo for this character.
					</p>
					<div className="flex gap-3 justify-center">
						<Button
							onClick={() => setDialogOpen(true)}
							size="lg"
							className="gap-2"
						>
							<Plus weight="bold" />
							Add Combo
						</Button>
					</div>
				</div>

				{comboFormDialog}
			</div>
		);
	}

	return (
		<div>
			<div className="flex flex-wrap items-center justify-between gap-4 mb-8 min-w-0">
				<div className="min-w-0 flex-1 flex items-center gap-4">
					<div
						className="w-20 h-14 rounded-lg shrink-0 border border-border overflow-hidden"
						style={{
							backgroundImage: `url(${character.portraitImage || defaultCharacterImage})`,
							backgroundSize: character.portraitZoom ? `${character.portraitZoom}%` : 'cover',
							backgroundPosition: character.portraitZoom ? `${character.portraitPanX ?? 50}% ${character.portraitPanY ?? 50}%` : 'center',
							backgroundRepeat: 'no-repeat',
						}}
					/>
					<div className="min-w-0">
						<h2 className="text-3xl font-bold mb-1 truncate">{character.name}</h2>
						<p className="text-muted-foreground flex items-center gap-2">
							<span>{game.name}</span>
							<span className="text-border">|</span>
							<span>{combos.length} combos</span>
						</p>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2 min-w-0">
					{/* Size slider removed: combo cards do not have a size toolbar. Text/icon toggle only affects display mode. */}
					<div className="bg-muted rounded-md">
						<DisplayModeToggle
							mode={displayMode}
							onChange={handleDisplayModeChange}
						/>
					</div>
					<div className="bg-muted rounded-md">
						<Button
							variant={showFilters ? 'secondary' : 'ghost'}
							onClick={() => setShowFilters(!showFilters)}
							title="Filter Combos"
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
								setIsSelecting(!isSelecting);
								if (isSelecting) setSelectedIds(new Set());
							}}
							title="Multi-select combos"
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
					<Button onClick={() => setDialogOpen(true)} className="gap-2">
						<Plus weight="bold" />
						Add Combo
					</Button>
				</div>
			</div>

			{character.notes?.trim() && (
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
								{character.notes}
							</p>
						</div>
					)}
				</div>
			)}

			{showFilters && (
				<ComboFilters
					filterSearch={filterSearch}
					onFilterSearchChange={setFilterSearch}
					filterTags={filterTags}
					onToggleFilterTag={toggleFilterTag}
					filterDifficulty={filterDifficulty}
					onFilterDifficultyChange={setFilterDifficulty}
					filterOutdated={filterOutdated}
					onFilterOutdatedChange={setFilterOutdated}
					allTags={allTags}
					hasActiveFilters={hasActiveFilters}
					onClearFilters={clearFilters}
					filteredCount={filteredCombos.length}
					totalCount={combos.length}
				/>
			)}

			{isSelecting && (
				<div className="flex items-center justify-between mb-4 p-3 bg-secondary rounded-lg">
					<div className="flex items-center gap-3">
						<span className="text-sm font-medium">
							{selectedIds.size} selected
						</span>
						<Button variant="ghost" size="sm" onClick={selectAll}>
							Select All
						</Button>
						{selectedIds.size > 0 && (
							<Button variant="ghost" size="sm" onClick={deselectAll}>
								Deselect All
							</Button>
						)}
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							className="gap-1.5 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
							disabled={selectedIds.size === 0}
							onClick={() => handleBulkMarkOutdated(true)}
						>
							<Warning className="w-4 h-4" />
							Mark Outdated ({selectedIds.size})
						</Button>
						<Button
							variant="destructive"
							size="sm"
							className="gap-1.5"
							disabled={selectedIds.size === 0}
							onClick={handleBulkDelete}
						>
							<Trash className="w-4 h-4" />
							Delete ({selectedIds.size})
						</Button>
					</div>
				</div>
			)}

			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={handleDragEnd}
			>
				<SortableContext
					items={filteredCombos.map((c) => c.id)}
					strategy={verticalListSortingStrategy}
				>
					<div className="grid grid-cols-1 gap-4">
						{filteredCombos.map((combo) => (
							<SortableComboCard
								key={combo.id}
								combo={combo}
								game={game}
								displayMode={displayMode}
								onEdit={handleEdit}
								onDuplicate={handleDuplicate}
								onDelete={handleDelete}
								onTagClick={handleTagClick}
								onWatchDemo={handleWatchDemo}
								isDragDisabled={hasActiveFilters || isSelecting}
								isSelecting={isSelecting}
								isSelected={selectedIds.has(combo.id)}
								onToggleSelect={toggleSelect}
							/>
						))}
					</div>
				</SortableContext>
			</DndContext>

			{filteredCombos.length === 0 && combos.length > 0 && (
				<div className="text-center py-12 text-muted-foreground">
					No combos match the current filters.
				</div>
			)}

			{comboFormDialog}

			<ButtonColorDialog
				open={colorDialogOpen}
				onOpenChange={setColorDialogOpen}
				game={game}
			/>

			<VideoPlayerDialog
				open={videoPlayerOpen}
				onClose={closeVideoPlayer}
				videoUrl={videoPlayerUrl}
				title={videoPlayerTitle}
				videoSize={videoSize}
				onVideoSizeChange={setVideoSize}
			/>

			{/* Single delete confirmation */}
			<AlertDialog
				open={!!deleteTarget}
				onOpenChange={(open) => !open && setDeleteTarget(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete combo?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete "
							{combos.find((c) => c.id === deleteTarget)?.name}". This action
							cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-white hover:bg-destructive/90"
							onClick={() => {
								if (deleteTarget) executeDelete(deleteTarget);
								setDeleteTarget(null);
							}}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Bulk delete confirmation */}
			<AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete {selectedIds.size} combo{selectedIds.size > 1 ? 's' : ''}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete the selected combos. This action
							cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-white hover:bg-destructive/90"
							onClick={() => {
								executeBulkDelete();
								setBulkDeleteConfirm(false);
							}}
						>
							Delete ({selectedIds.size})
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
