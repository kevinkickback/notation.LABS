import { useState } from 'react';
import { toast } from 'sonner';
import { reportError } from '@/lib/errors';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import type { Character } from '@/lib/types';

/**
 * Manages character delete confirmation state and operations.
 */
export function useCharacterDelete() {
  const [deleteTarget, setDeleteTarget] = useState<Character | null>(null);

  const handleDeleteCharacter = async (character: Character) => {
    try {
      await indexedDbStorage.characters.delete(character.id);
      toast.success(`"${character.name}" deleted`);
      setDeleteTarget(null);
    } catch (err) {
      reportError('useCharacterDelete.handleDeleteCharacter', err);
      toast.error('Failed to delete character');
    }
  };

  const handleBulkDeleteCharacters = async (characters: Character[]) => {
    if (characters.length === 0) {
      return;
    }

    try {
      await indexedDbStorage.characters.bulkDelete(characters.map((c) => c.id));
      toast.success(
        `${characters.length} character${characters.length > 1 ? 's' : ''} deleted`,
      );
      setDeleteTarget(null);
    } catch (err) {
      reportError('useCharacterDelete.handleBulkDeleteCharacters', err);
      toast.error('Failed to delete selected characters');
    }
  };

  return {
    deleteTarget,
    setDeleteTarget,
    handleDeleteCharacter,
    handleBulkDeleteCharacters,
  };
}
