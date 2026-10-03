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
import { useCallback, useEffect, useRef, useState } from 'react';
import { ComboFilters } from '@/components/combo/ComboFilters';
import { ComboFormDialog } from '@/components/combo/ComboFormDialog';
import { ComboSelectionToolbar } from '@/components/combo/ComboSelectionToolbar';
import { ComboViewEmptyState } from '@/components/combo/ComboViewEmptyState';
import { ComboViewHeader } from '@/components/combo/ComboViewHeader';
import { ComboViewToolbar } from '@/components/combo/ComboViewToolbar';
import { SortableComboCard } from '@/components/combo/SortableComboCard';
import { VideoPlayerDialog } from '@/components/combo/VideoPlayerDialog';
import { ButtonColorDialog } from '@/components/shared/ButtonColorDialog';
import { DestructiveConfirmationDialog } from '@/components/shared/DestructiveConfirmationDialog';
import {
  EntityNotebook,
  type EntityNotebookRef,
  NotebookTriggerSlot,
  NotebookWorkspace,
} from '@/components/shared/EntityNotebook';
import { useSettings, useSettingsActions } from '@/context/SettingsContext';
import { useComboDelete } from '@/hooks/useComboDelete';
import { useComboFilters } from '@/hooks/useComboFilters';
import { useComboOperations } from '@/hooks/useComboOperations';
import { useNotebookOpen } from '@/hooks/useNotebookOpen';
import { useSelection } from '@/hooks/useSelection';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { reorderCombos } from '@/lib/application/comboCommands';
import type { Character, Combo, DisplayMode, Game } from '@/lib/types';

interface ComboViewProps {
  game: Game;
  character: Character;
  combos: Combo[];
}

export function ComboView({ game, character, combos }: ComboViewProps) {
  const settings = useSettings();
  const { setSetting } = useSettingsActions();
  const displayMode = settings.displayMode;
  const [colorDialogOpen, setColorDialogOpen] = useState(false);

  const filters = useComboFilters(combos);
  const selection = useSelection();
  const videoPlayer = useVideoPlayer(settings.videoPlayerSize, character.id);
  const deleteState = useComboDelete({
    confirmBeforeDelete: settings.confirmBeforeDelete ?? false,
  });
  const operations = useComboOperations();

  const [showInfo, handleToggleInfo] = useNotebookOpen(character.id);
  const notebookRef = useRef<EntityNotebookRef>(null);

  const handleEditNote = useCallback(() => notebookRef.current?.editNote(), []);

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

  const handleDisplayModeChange = useCallback(
    async (mode: DisplayMode) => {
      await setSetting('displayMode', mode);
    },
    [setSetting],
  );

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
      await reorderCombos(reordered.map((combo) => combo.id));
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

  const handleBulkDelete = useCallback(async () => {
    const deleted = await deleteState.handleBulkDelete(selection.selectedIds);
    if (deleted) {
      selection.clearSelection();
    }
  }, [deleteState, selection.selectedIds, selection.clearSelection]);

  const handleBulkMarkOutdated = useCallback(async () => {
    await operations.handleBulkMarkOutdated(selection.selectedIds, true);
    selection.clearSelection();
  }, [operations, selection]);

  return (
    <NotebookWorkspace>
      {combos.length === 0 ? (
        <ComboViewEmptyState
          game={game}
          character={character}
          onAddCombo={() => operations.setDialogOpen(true)}
          onEditNote={handleEditNote}
        />
      ) : (
        <>
          {/* Header with character info and toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <ComboViewHeader
              character={character}
              game={game}
              comboCount={combos.length}
            />
            {selection.isSelecting ? (
              <ComboSelectionToolbar
                leadingAction={<NotebookTriggerSlot />}
                selectedCount={selection.selectedIds.size}
                onSelectAll={() =>
                  selection.selectAll(filters.filteredCombos.map((c) => c.id))
                }
                onDeselectAll={selection.deselectAll}
                onMarkOutdated={handleBulkMarkOutdated}
                onDelete={handleBulkDelete}
                onCancel={selection.clearSelection}
              />
            ) : (
              <ComboViewToolbar
                leadingAction={<NotebookTriggerSlot />}
                displayMode={displayMode}
                onDisplayModeChange={handleDisplayModeChange}
                showFilters={filters.showFilters}
                onToggleFilters={() =>
                  filters.setShowFilters(!filters.showFilters)
                }
                activeFilterCount={filters.activeFilterCount}
                isSelecting={selection.isSelecting}
                onToggleSelect={() => {
                  selection.setIsSelecting(!selection.isSelecting);
                  if (selection.isSelecting) selection.deselectAll();
                }}
                onAddCombo={() => operations.setDialogOpen(true)}
                onOpenColorDialog={() => setColorDialogOpen(true)}
              />
            )}
          </div>
        </>
      )}

      <EntityNotebook
        key={character.id}
        ref={notebookRef}
        kind="character"
        entityId={character.id}
        entityName={character.name}
        notes={character.notes || ''}
        links={character.links ?? []}
        isOpen={showInfo}
        onToggle={handleToggleInfo}
        hideTrigger={combos.length === 0}
      />

      {combos.length > 0 && (
        <>
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

          {/* Multi-select toolbar is now inline in the header row */}

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
        </>
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

      <DestructiveConfirmationDialog
        open={!!deleteState.deleteTarget}
        onOpenChange={(open) => !open && deleteState.setDeleteTarget(null)}
        title="Delete combo?"
        description={`This will permanently delete "${
          combos.find((combo) => combo.id === deleteState.deleteTarget)?.name
        }". This action cannot be undone.`}
        onConfirm={async () => {
          if (!deleteState.deleteTarget) return;
          const deleted = await deleteState.executeDelete(
            deleteState.deleteTarget,
          );
          if (deleted) deleteState.setDeleteTarget(null);
        }}
      />

      <DestructiveConfirmationDialog
        open={deleteState.bulkDeleteConfirm}
        onOpenChange={deleteState.setBulkDeleteConfirm}
        title={`Delete ${selection.selectedIds.size} combo${
          selection.selectedIds.size > 1 ? 's' : ''
        }?`}
        description="This will permanently delete the selected combos. This action cannot be undone."
        actionLabel={`Delete (${selection.selectedIds.size})`}
        onConfirm={async () => {
          const deleted = await deleteState.executeBulkDelete(
            selection.selectedIds,
          );
          if (deleted) {
            deleteState.setBulkDeleteConfirm(false);
            selection.clearSelection();
          }
        }}
      />
    </NotebookWorkspace>
  );
}
