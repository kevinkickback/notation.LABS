import type { Game, Character } from '@/lib/types';
import { useIsMobile } from '@/hooks/useIsMobile';
import { CharacterFormDialog } from './CharacterFormDialog';
import { CharacterViewHeader } from './CharacterViewHeader';
import { CharacterViewToolbar } from './CharacterViewToolbar';
import { CharacterViewNotes } from './CharacterViewNotes';
import { CharacterViewFilterPanel } from './CharacterViewFilterPanel';
import { CharacterViewEmptyState } from './CharacterViewEmptyState';
import { CharacterGridCard } from './CharacterGridCard';
import { CharacterListCard } from './CharacterListCard';
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
import { db } from '@/lib/storage/indexedDbStorage';
import { useAppStore } from '@/lib/store';
import { useSettings } from '@/context/SettingsContext';
import { useNotesOverride } from '@/hooks/useNotesOverride';
import { ButtonColorDialog } from '@/components/shared/ButtonColorDialog';
import { SelectionToolbar } from '@/components/shared/SelectionToolbar';
import { useCharacterFilters } from '@/hooks/useCharacterFilters';
import { useCharacterSelection } from '@/hooks/useCharacterSelection';
import { useCharacterViewMode } from '@/hooks/useCharacterViewMode';
import { useCharacterDelete } from '@/hooks/useCharacterDelete';
import { useCharacterOperations } from '@/hooks/useCharacterOperations';

interface CharacterViewProps {
  game: Game;
  characters: Character[];
}

export function CharacterView({ game, characters }: CharacterViewProps) {
  const isMobile = useIsMobile();
  const { setSelectedCharacter } = useAppStore();
  const settings = useSettings();

  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const selection = useCharacterSelection();
  const viewMode = useCharacterViewMode(settings.characterCardSize);
  const deleteState = useCharacterDelete();
  const operations = useCharacterOperations();

  const [showNotes, handleToggleNotes] = useNotesOverride(
    game.id,
    settings.notesDefaultOpen ?? false,
  );

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

  const filters = useCharacterFilters(
    characters,
    comboCountByChar,
    lastModifiedByChar,
  );

  const handleDeleteCharacter = async (character: Character) => {
    await deleteState.handleDeleteCharacter(character);
    selection.setSelectedIds((prev) => {
      if (!prev.has(character.id)) return prev;
      const next = new Set(prev);
      next.delete(character.id);
      return next;
    });
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
    for (const id of selection.selectedIds) {
      const character = characters.find((c) => c.id === id);
      if (character) {
        await handleDeleteCharacter(character);
      }
    }
    selection.clearSelection();
  };

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
        <CharacterViewToolbar
          viewMode={viewMode.viewMode}
          onViewModeChange={viewMode.setViewMode}
          cardSize={viewMode.cardSize}
          onCardSizeChange={viewMode.handleCardSizeChange}
          showFilters={filters.showFilters}
          onToggleFilters={filters.toggleFilters}
          activeFilterCount={filters.activeFilterCount}
          isSelecting={selection.isSelecting}
          onToggleSelect={selection.toggleSelectionMode}
          onOpenColorDialog={() => setColorDialogOpen(true)}
          onAddCharacter={operations.openAddDialog}
        />
      </div>

      <CharacterViewNotes
        notes={game.notes || ''}
        isOpen={showNotes}
        onToggle={handleToggleNotes}
      />

      {filters.showFilters && (
        <CharacterViewFilterPanel
          filterSearch={filters.filterSearch}
          onFilterSearchChange={filters.setFilterSearch}
          sortBy={filters.sortBy}
          onSortByChange={filters.setSortBy}
          hasActiveFilters={filters.hasActiveFilters}
          onClearFilters={filters.clearFilters}
          filteredCount={filters.filteredAndSorted.length}
          totalCount={characters.length}
        />
      )}

      {selection.isSelecting && (
        <SelectionToolbar
          selectedCount={selection.selectedIds.size}
          onSelectAll={() =>
            selection.selectAll(filters.filteredAndSorted.map((c) => c.id))
          }
          onDeselectAll={selection.deselectAll}
          onDelete={() => {
            void handleBulkDelete();
          }}
        />
      )}

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
              onSelect={() => handleCharacterSelect(character.id)}
              onEdit={() => operations.openEditDialog(character)}
              onDelete={() => {
                if (settings.confirmBeforeDelete) {
                  deleteState.setDeleteTarget(character);
                } else {
                  void handleDeleteCharacter(character);
                }
              }}
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
        <AlertDialog
          open={!!deleteState.deleteTarget}
          onOpenChange={(open) => !open && deleteState.setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {deleteState.deleteTarget?.name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {(() => {
                  if (!deleteState.deleteTarget) return '';
                  const comboCount =
                    comboCountByChar[deleteState.deleteTarget.id] || 0;
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
                onClick={() => {
                  if (deleteState.deleteTarget) {
                    void handleDeleteCharacter(deleteState.deleteTarget);
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selection.selectedIds.size} character
              {selection.selectedIds.size !== 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will also delete {selectedComboCount} combo
              {selectedComboCount !== 1 ? 's' : ''}. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                for (const id of selection.selectedIds) {
                  const character = characters.find((c) => c.id === id);
                  if (character) {
                    await handleDeleteCharacter(character);
                  }
                }
                setBulkDeleteConfirm(false);
                selection.clearSelection();
              }}
            >
              Delete Selected ({selection.selectedIds.size})
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
