import { useCallback, useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ButtonColorDialog } from '@/components/shared/ButtonColorDialog';
import { DestructiveConfirmationDialog } from '@/components/shared/DestructiveConfirmationDialog';
import { EntityNoteDialog } from '@/components/shared/EntityNoteDialog';
import { SelectionToolbar } from '@/components/shared/SelectionToolbar';
import { useSettings } from '@/context/SettingsContext';
import { useCharacterComboStatistics } from '@/hooks/useCharacterComboStatistics';
import { useCharacterDelete } from '@/hooks/useCharacterDelete';
import { useCharacterFilters } from '@/hooks/useCharacterFilters';
import { useCharacterOperations } from '@/hooks/useCharacterOperations';
import { useCharacterViewMode } from '@/hooks/useCharacterViewMode';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useNotesOverride } from '@/hooks/useNotesOverride';
import { useSelection } from '@/hooks/useSelection';
import { setCharacterFavorite } from '@/lib/application/characterCommands';
import { updateGame } from '@/lib/application/gameCommands';
import { reportError } from '@/lib/errors';
import { useAppStore } from '@/lib/store';
import type { Character, Game } from '@/lib/types';
import { CharacterFormDialog } from './CharacterFormDialog';
import { CharacterGridCard } from './CharacterGridCard';
import { CharacterListCard } from './CharacterListCard';
import { CharacterViewEmptyState } from './CharacterViewEmptyState';
import { CharacterViewHeader } from './CharacterViewHeader';
import { CharacterViewNotes } from './CharacterViewNotes';
import { CharacterViewToolbar } from './CharacterViewToolbar';

interface CharacterViewProps {
  game: Game;
  characters: Character[];
}

export function CharacterView({ game, characters }: CharacterViewProps) {
  const isMobile = useIsMobile();
  const { setSelectedCharacter } = useAppStore();
  const settings = useSettings();

  const gameNoteEditorId = useId();
  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(game.notes || '');

  const selection = useSelection();
  const viewMode = useCharacterViewMode(settings.characterCardSize);
  const deleteState = useCharacterDelete();
  const operations = useCharacterOperations();

  const [showNotes, handleToggleNotes] = useNotesOverride(
    game.id,
    settings.notesDefaultOpen ?? false,
  );

  const combos = useCharacterComboStatistics(
    characters.map((character) => character.id),
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

  const filters = useCharacterFilters(
    characters,
    comboCountByChar,
    lastModifiedByChar,
  );

  const handleToggleFavorite = async (character: Character) => {
    try {
      await setCharacterFavorite(character.id, !character.favorite);
    } catch (error) {
      reportError('CharacterView.toggleFavorite', error);
      toast.error('Failed to update favorite');
    }
  };

  const handleDeleteCharacter = async (character: Character) => {
    const deleted = await deleteState.handleDeleteCharacter(character);
    if (deleted) {
      selection.setSelectedIds((prev) => {
        if (!prev.has(character.id)) return prev;
        const next = new Set(prev);
        next.delete(character.id);
        return next;
      });
    }
    return deleted;
  };

  const handleCharacterSelect = (characterId: string) => {
    if (!selection.isSelecting) {
      setSelectedCharacter(characterId);
      return;
    }
    selection.toggleSelect(characterId);
  };

  const selectedComboCount = useMemo(() => {
    let comboCount = 0;
    for (const id of selection.selectedIds) {
      comboCount += comboCountByChar[id] || 0;
    }
    return comboCount;
  }, [selection.selectedIds, comboCountByChar]);

  const handleBulkDelete = async () => {
    if (selection.selectedIds.size === 0) return;
    if (settings.confirmBeforeDelete) {
      setBulkDeleteConfirm(true);
      return;
    }
    const selectedCharacters = characters.filter((character) =>
      selection.selectedIds.has(character.id),
    );
    const deleted =
      await deleteState.handleBulkDeleteCharacters(selectedCharacters);
    if (deleted) {
      selection.clearSelection();
    }
  };

  const openNoteDialog = useCallback(() => {
    setNoteDraft(game.notes || '');
    setNoteDialogOpen(true);
  }, [game.notes]);

  const handleSaveNote = useCallback(async () => {
    try {
      await updateGame(game.id, {
        notes: noteDraft.trim(),
      });
      toast.success('Note updated');
      setNoteDialogOpen(false);
    } catch (error) {
      reportError('CharacterView.handleSaveNote', error);
      toast.error('Failed to update note');
    }
  }, [game.id, noteDraft]);

  if (characters.length === 0) {
    return (
      <>
        <CharacterViewEmptyState
          game={game}
          onAddCharacter={operations.openAddDialog}
        />
        <CharacterFormDialog
          open={operations.characterDialogOpen}
          onOpenChange={operations.setCharacterDialogOpen}
          editingCharacter={operations.editingCharacter}
          game={game}
        />
      </>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 min-w-0">
        <CharacterViewHeader game={game} />
        {selection.isSelecting ? (
          <SelectionToolbar
            selectedCount={selection.selectedIds.size}
            onSelectAll={() =>
              selection.selectAll(filters.filteredAndSorted.map((c) => c.id))
            }
            onDeselectAll={selection.deselectAll}
            onDelete={() => {
              void handleBulkDelete();
            }}
            onCancel={selection.clearSelection}
          />
        ) : (
          <CharacterViewToolbar
            filterSearch={filters.filterSearch}
            onFilterSearchChange={filters.setFilterSearch}
            sortBy={filters.sortBy}
            onSortByChange={filters.setSortBy}
            viewMode={viewMode.viewMode}
            onViewModeChange={viewMode.setViewMode}
            cardSize={viewMode.cardSize}
            onCardSizeChange={viewMode.handleCardSizeChange}
            onToggleSelect={selection.toggleSelectionMode}
            onOpenColorDialog={() => setColorDialogOpen(true)}
            onAddCharacter={operations.openAddDialog}
          />
        )}
      </div>

      <CharacterViewNotes
        notes={game.notes || ''}
        isOpen={showNotes}
        onToggle={handleToggleNotes}
        onEditNote={openNoteDialog}
      />

      <div
        className={
          viewMode.viewMode === 'list' ? 'flex flex-col gap-3' : 'grid gap-4'
        }
        style={
          viewMode.viewMode === 'grid'
            ? {
                gridTemplateColumns: `repeat(auto-fill, minmax(${Math.round((viewMode.cardSize * 4) / 3)}px, 1fr))`,
              }
            : undefined
        }
      >
        {filters.filteredAndSorted.map((character) =>
          viewMode.viewMode === 'grid' ? (
            <CharacterGridCard
              key={character.id}
              character={character}
              comboCount={comboCountByChar[character.id] || 0}
              isMobile={isMobile}
              isSelecting={selection.isSelecting}
              isSelected={selection.selectedIds.has(character.id)}
              orientation={
                character.portraitOrientation ??
                settings.characterCardOrientation ??
                'landscape'
              }
              onSelect={() => handleCharacterSelect(character.id)}
              onEdit={() => operations.openEditDialog(character)}
              onDelete={() => {
                if (settings.confirmBeforeDelete) {
                  deleteState.setDeleteTarget(character);
                } else {
                  void handleDeleteCharacter(character);
                }
              }}
              onToggleFavorite={() => void handleToggleFavorite(character)}
            />
          ) : (
            <CharacterListCard
              key={character.id}
              character={character}
              comboCount={comboCountByChar[character.id] || 0}
              lastModified={
                lastModifiedByChar[character.id] || character.updatedAt
              }
              isMobile={isMobile}
              isSelecting={selection.isSelecting}
              isSelected={selection.selectedIds.has(character.id)}
              onSelect={() => handleCharacterSelect(character.id)}
              onEdit={() => operations.openEditDialog(character)}
              onDelete={() => {
                if (settings.confirmBeforeDelete) {
                  deleteState.setDeleteTarget(character);
                } else {
                  void handleDeleteCharacter(character);
                }
              }}
              onToggleFavorite={() => void handleToggleFavorite(character)}
            />
          ),
        )}
      </div>

      <CharacterFormDialog
        open={operations.characterDialogOpen}
        onOpenChange={operations.setCharacterDialogOpen}
        editingCharacter={operations.editingCharacter}
        game={game}
      />

      {settings.confirmBeforeDelete && (
        <DestructiveConfirmationDialog
          open={!!deleteState.deleteTarget}
          onOpenChange={(open) => !open && deleteState.setDeleteTarget(null)}
          title={`Delete ${deleteState.deleteTarget?.name}?`}
          description={(() => {
            if (!deleteState.deleteTarget) return '';
            const comboCount =
              comboCountByChar[deleteState.deleteTarget.id] || 0;
            if (comboCount === 0) {
              return 'This character has no combos. This action cannot be undone.';
            }
            return `This will also delete ${comboCount} combo${comboCount !== 1 ? 's' : ''}. This action cannot be undone.`;
          })()}
          onConfirm={async () => {
            if (deleteState.deleteTarget) {
              await handleDeleteCharacter(deleteState.deleteTarget);
            }
          }}
        />
      )}

      <DestructiveConfirmationDialog
        open={bulkDeleteConfirm}
        onOpenChange={setBulkDeleteConfirm}
        title={`Delete ${selection.selectedIds.size} character${
          selection.selectedIds.size !== 1 ? 's' : ''
        }?`}
        description={`This will also delete ${selectedComboCount} combo${selectedComboCount !== 1 ? 's' : ''}. This action cannot be undone.`}
        actionLabel={`Delete Selected (${selection.selectedIds.size})`}
        onConfirm={async () => {
          const selectedCharacters = characters.filter((character) =>
            selection.selectedIds.has(character.id),
          );
          const deleted =
            await deleteState.handleBulkDeleteCharacters(selectedCharacters);
          if (deleted) {
            setBulkDeleteConfirm(false);
            selection.clearSelection();
          }
        }}
      />

      <ButtonColorDialog
        open={colorDialogOpen}
        onOpenChange={setColorDialogOpen}
        game={game}
      />

      <EntityNoteDialog
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        editorId={gameNoteEditorId}
        entityName={game.name}
        value={noteDraft}
        onValueChange={setNoteDraft}
        onSave={() => void handleSaveNote()}
      />
    </div>
  );
}
