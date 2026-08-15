import { useState } from 'react';
import { toast } from 'sonner';
import {
  deleteCharacter,
  deleteCharacters,
} from '@/lib/application/characterCommands';
import { reportError } from '@/lib/errors';
import type { Character } from '@/lib/types';

/**
 * Manages character delete confirmation state and operations.
 */
export function useCharacterDelete() {
  const [deleteTarget, setDeleteTarget] = useState<Character | null>(null);

  const handleDeleteCharacter = async (character: Character) => {
    try {
      await deleteCharacter(character.id);
      toast.success(`"${character.name}" deleted`);
      setDeleteTarget(null);
      return true;
    } catch (err) {
      reportError('useCharacterDelete.handleDeleteCharacter', err);
      toast.error('Failed to delete character');
      return false;
    }
  };

  const handleBulkDeleteCharacters = async (characters: Character[]) => {
    if (characters.length === 0) {
      return false;
    }

    try {
      await deleteCharacters(characters.map((character) => character.id));
      toast.success(
        `${characters.length} character${characters.length > 1 ? 's' : ''} deleted`,
      );
      setDeleteTarget(null);
      return true;
    } catch (err) {
      reportError('useCharacterDelete.handleBulkDeleteCharacters', err);
      toast.error('Failed to delete selected characters');
      return false;
    }
  };

  return {
    deleteTarget,
    setDeleteTarget,
    handleDeleteCharacter,
    handleBulkDeleteCharacters,
  };
}
