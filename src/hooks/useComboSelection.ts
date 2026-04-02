import { useState } from 'react';

/**
 * Manages multi-select state and operations for combos
 */
export function useComboSelection() {
	const [isSelecting, setIsSelecting] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	const toggleSelect = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const selectAll = (ids: string[]) => {
		setSelectedIds(new Set(ids));
	};

	const deselectAll = () => {
		setSelectedIds(new Set());
	};

	const clearSelection = () => {
		setSelectedIds(new Set());
		setIsSelecting(false);
	};

	return {
		isSelecting,
		setIsSelecting,
		selectedIds,
		toggleSelect,
		selectAll,
		deselectAll,
		clearSelection,
	};
}
