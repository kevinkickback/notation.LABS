import { useState } from 'react';
import type { Character } from '@/lib/types';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { reportError } from '@/lib/errors';
import { toast } from 'sonner';

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
