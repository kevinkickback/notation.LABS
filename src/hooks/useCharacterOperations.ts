import { useCallback, useState } from 'react';
import type { Character } from '@/lib/types';

/**
 * Manages character dialog state (add/edit).
 */
export function useCharacterOperations() {
	const [characterDialogOpen, setCharacterDialogOpen] = useState(false);
	const [editingCharacter, setEditingCharacter] = useState<Character | null>(
		null,
	);

	const openEditDialog = useCallback((character: Character) => {
		setEditingCharacter(character);
		setCharacterDialogOpen(true);
	}, []);

	const openAddDialog = useCallback(() => {
		setEditingCharacter(null);
		setCharacterDialogOpen(true);
	}, []);

	return {
		characterDialogOpen,
		setCharacterDialogOpen,
		editingCharacter,
		setEditingCharacter,
		openEditDialog,
		openAddDialog,
	};
}
