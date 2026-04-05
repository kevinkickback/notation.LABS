import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useCallback, useEffect, useState } from 'react';
import { ComboFilters } from '@/components/combo/ComboFilters';
import { ComboFormDialog } from '@/components/combo/ComboFormDialog';
import { ComboSelectionToolbar } from '@/components/combo/ComboSelectionToolbar';
import { ComboViewEmptyState } from '@/components/combo/ComboViewEmptyState';
import { ComboViewHeader } from '@/components/combo/ComboViewHeader';
import { ComboViewNotes } from '@/components/combo/ComboViewNotes';
import { ComboViewToolbar } from '@/components/combo/ComboViewToolbar';
import { SortableComboCard } from '@/components/combo/SortableComboCard';
import { VideoPlayerDialog } from '@/components/combo/VideoPlayerDialog';
import { ButtonColorDialog } from '@/components/shared/ButtonColorDialog';
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
import { useSettings } from '@/context/SettingsContext';
import { useComboDelete } from '@/hooks/useComboDelete';
import { useComboFilters } from '@/hooks/useComboFilters';
import { useComboOperations } from '@/hooks/useComboOperations';
import { useComboSelection } from '@/hooks/useComboSelection';
import { useNotesOverride } from '@/hooks/useNotesOverride';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import type { Character, Combo, DisplayMode, Game } from '@/lib/types';

interface ComboViewProps {
  game: Game;
  character: Character;
  combos: Combo[];
}

export function ComboView({ game, character, combos }: ComboViewProps) {
  const settings = useSettings();
  const displayMode = settings.displayMode;
  const [colorDialogOpen, setColorDialogOpen] = useState(false);

  const filters = useComboFilters(combos);
  const selection = useComboSelection();
  const videoPlayer = useVideoPlayer(settings.videoPlayerSize);
  const deleteState = useComboDelete({
    confirmBeforeDelete: settings.confirmBeforeDelete ?? false,
  });
  const operations = useComboOperations();

  const [showNotes, handleToggleNotes] = useNotesOverride(
    character.id,
    settings.notesDefaultOpen ?? false,
  );

  // Sync video size from settings
  useEffect(() => {
    videoPlayer.setVideoSize(settings.videoPlayerSize);
  }, [settings.videoPlayerSize, videoPlayer]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDisplayModeChange = useCallback(async (mode: DisplayMode) => {
    await indexedDbStorage.settings.update({ displayMode: mode });
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = filters.filteredCombos.findIndex(
        (c) => c.id === active.id,
      );
      const newIndex = filters.filteredCombos.findIndex(
        (c) => c.id === over.id,
      );
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(filters.filteredCombos, oldIndex, newIndex);
      await indexedDbStorage.combos.reorder(reordered.map((c) => c.id));
    },
    [filters.filteredCombos],
  );

  const handleDelete = useCallback(
    async (comboId: string) => {
      await deleteState.handleDelete(comboId);
    },
    [deleteState],
  );

  const handleTagClick = useCallback(
    (tag: string) => {
      if (!filters.showFilters) filters.setShowFilters(true);
      filters.addFilterTag(tag);
    },
    [filters],
  );

  const handleBulkDelete = useCallback(() => {
    deleteState.handleBulkDelete(selection.selectedIds);
  }, [deleteState, selection.selectedIds]);

  const handleBulkMarkOutdated = useCallback(async () => {
    await operations.handleBulkMarkOutdated(selection.selectedIds, true);
    selection.clearSelection();
  }, [operations, selection]);

  if (combos.length === 0) {
    return (
      <div>
        <ComboViewEmptyState
          game={game}
          character={character}
          onAddCombo={() => operations.setDialogOpen(true)}
        />
        <ComboFormDialog
          open={operations.dialogOpen}
          onOpenChange={(open) => {
            operations.setDialogOpen(open);
            if (!open) operations.setEditingCombo(null);
          }}
          game={game}
          character={character}
          editingCombo={operations.editingCombo}
          allTags={filters.allTags}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Header with character info and toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <ComboViewHeader
          character={character}
          game={game}
          comboCount={combos.length}
        />
        <ComboViewToolbar
          displayMode={displayMode}
          onDisplayModeChange={handleDisplayModeChange}
          showFilters={filters.showFilters}
          onToggleFilters={() => filters.setShowFilters(!filters.showFilters)}
          activeFilterCount={filters.activeFilterCount}
          isSelecting={selection.isSelecting}
          onToggleSelect={() => {
            selection.setIsSelecting(!selection.isSelecting);
            if (selection.isSelecting) selection.deselectAll();
          }}
          onAddCombo={() => operations.setDialogOpen(true)}
          onOpenColorDialog={() => setColorDialogOpen(true)}
        />
      </div>

      {/* Notes section */}
      <ComboViewNotes
        notes={character.notes || ''}
        isOpen={showNotes}
        onToggle={handleToggleNotes}
      />

      {/* Filter panel */}
      {filters.showFilters && (
        <ComboFilters
          filterSearch={filters.filterSearch}
          onFilterSearchChange={filters.setFilterSearch}
          filterTags={filters.filterTags}
          onToggleFilterTag={filters.toggleFilterTag}
          filterDifficulty={filters.filterDifficulty}
          onFilterDifficultyChange={filters.setFilterDifficulty}
          filterOutdated={filters.filterOutdated}
          onFilterOutdatedChange={filters.setFilterOutdated}
          allTags={filters.allTags}
          hasActiveFilters={filters.hasActiveFilters}
          onClearFilters={filters.clearFilters}
          filteredCount={filters.filteredCombos.length}
          totalCount={combos.length}
        />
      )}

      {/* Multi-select toolbar */}
      {selection.isSelecting && (
        <ComboSelectionToolbar
          selectedCount={selection.selectedIds.size}
          onSelectAll={() =>
            selection.selectAll(filters.filteredCombos.map((c) => c.id))
          }
          onDeselectAll={selection.deselectAll}
          onMarkOutdated={handleBulkMarkOutdated}
          onDelete={handleBulkDelete}
        />
      )}

      {/* Combo list with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={filters.filteredCombos.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid grid-cols-1 gap-4">
            {filters.filteredCombos.map((combo) => (
              <SortableComboCard
                key={combo.id}
                combo={combo}
                game={game}
                displayMode={displayMode}
                onEdit={operations.handleEdit}
                onDuplicate={operations.handleDuplicate}
                onDelete={handleDelete}
                onTagClick={handleTagClick}
                onWatchDemo={videoPlayer.handleWatchDemo}
                isDragDisabled={
                  filters.hasActiveFilters || selection.isSelecting
                }
                isSelecting={selection.isSelecting}
                isSelected={selection.selectedIds.has(combo.id)}
                onToggleSelect={selection.toggleSelect}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Empty filter results message */}
      {filters.filteredCombos.length === 0 && combos.length > 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No combos match the current filters.
        </div>
      )}

      {/* Dialogs */}
      <ComboFormDialog
        open={operations.dialogOpen}
        onOpenChange={(open) => {
          operations.setDialogOpen(open);
          if (!open) operations.setEditingCombo(null);
        }}
        game={game}
        character={character}
        editingCombo={operations.editingCombo}
        allTags={filters.allTags}
      />

      <ButtonColorDialog
        open={colorDialogOpen}
        onOpenChange={setColorDialogOpen}
        game={game}
      />

      <VideoPlayerDialog
        open={videoPlayer.videoPlayerOpen}
        onClose={videoPlayer.closeVideoPlayer}
        videoUrl={videoPlayer.videoPlayerUrl}
        title={videoPlayer.videoPlayerTitle}
        videoSize={videoPlayer.videoSize}
        onVideoSizeChange={videoPlayer.setVideoSize}
      />

      {/* Delete confirmation dialogs */}
      <AlertDialog
        open={!!deleteState.deleteTarget}
        onOpenChange={(open) => !open && deleteState.setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete combo?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "
              {combos.find((c) => c.id === deleteState.deleteTarget)?.name}
              ". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleteState.deleteTarget) {
                  deleteState.executeDelete(deleteState.deleteTarget);
                }
                deleteState.setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteState.bulkDeleteConfirm}
        onOpenChange={deleteState.setBulkDeleteConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selection.selectedIds.size} combo
              {selection.selectedIds.size > 1 ? 's' : ''}?
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
              onClick={async () => {
                await deleteState.executeBulkDelete(selection.selectedIds);
                deleteState.setBulkDeleteConfirm(false);
                selection.clearSelection();
              }}
            >
              Delete ({selection.selectedIds.size})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
