import type { Game, Character, Combo, DisplayMode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
	Plus,
	Lightning,
	Funnel,
	CheckSquare,
	Trash,
	Warning,
} from '@phosphor-icons/react';
import { useState, useMemo, useCallback } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useAppStore } from '@/lib/store';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { DisplayModeToggle } from '@/components/combo/DisplayModeToggle';
import { ComboFormDialog } from '@/components/combo/ComboFormDialog';
import { VideoPlayerDialog } from '@/components/combo/VideoPlayerDialog';
import { ComboFilters } from '@/components/combo/ComboFilters';
import { SortableComboCard } from '@/components/combo/SortableComboCard';
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
	const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
	const [filterOutdated, setFilterOutdated] = useState<'all' | 'outdated' | 'current'>('all');
	const [filterSearch, setFilterSearch] = useState('');

	// Multi-select state
	const [isSelecting, setIsSelecting] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	// Delete confirmation state
	const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
	const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

	// Sync video size from settings
	const effectiveVideoSize = settings.videoPlayerSize;
	if (videoSize !== effectiveVideoSize) setVideoSize(effectiveVideoSize);

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
		filterTags.length > 0 || filterDifficulty !== 'all' || filterOutdated !== 'all' || filterSearch !== '';
	const isFiltering = hasActiveFilters;

	const handleDisplayModeChange = async (mode: DisplayMode) => {
		await indexedDbStorage.settings.update({ displayMode: mode });
		useAppStore.getState().notifySettingsChanged();
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
				demoUrl: combo.demoUrl?.startsWith('local:') ? '' : (combo.demoUrl ?? ''),
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
			for (const id of selectedIds) {
				await indexedDbStorage.combos.update(id, { outdated: outdated || undefined });
			}
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
			for (const id of selectedIds) {
				const combo = combos.find((c) => c.id === id);
				if (combo?.demoUrl?.startsWith('local:')) {
					await indexedDbStorage.demoVideos.delete(
						combo.demoUrl.replace('local:', ''),
					);
				}
				await indexedDbStorage.combos.delete(id);
			}
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
			window.open(combo.demoUrl, '_blank', 'noopener,noreferrer');
		}
	}, []);

	const closeVideoPlayer = useCallback(() => {
		setVideoPlayerOpen(false);
		if (videoPlayerUrl) {
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
			<div className="flex items-center justify-between mb-8">
				<div>
					<h2 className="text-3xl font-bold mb-1">{character.name}</h2>
					<p className="text-muted-foreground">
						{game.name} • {combos.length} combos
					</p>
				</div>
				<div className="flex items-center gap-3">
					<Button
						variant={isSelecting ? 'secondary' : 'ghost'}
						size="icon"
						onClick={() => {
							setIsSelecting(!isSelecting);
							if (isSelecting) setSelectedIds(new Set());
						}}
						title="Select Combos"
					>
						<CheckSquare className="w-5 h-5" />
					</Button>
					<Button
						variant={showFilters ? 'secondary' : 'ghost'}
						size="icon"
						onClick={() => setShowFilters(!showFilters)}
						title="Filter Combos"
						className="relative"
					>
						<Funnel className="w-5 h-5" />
						{hasActiveFilters && (
							<span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full" />
						)}
					</Button>
					<DisplayModeToggle
						mode={displayMode}
						onChange={handleDisplayModeChange}
					/>
					<Button onClick={() => setDialogOpen(true)} className="gap-2">
						<Plus weight="bold" />
						Add Combo
					</Button>
				</div>
			</div>

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
								isDragDisabled={isFiltering || isSelecting}
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
