import { useState } from 'react';

/**
 * Manages multi-select state and operations for characters.
 */
export function useCharacterSelection() {
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

  const toggleSelectionMode = () => {
    setIsSelecting((prev) => {
      if (prev) {
        setSelectedIds(new Set());
      }
      return !prev;
    });
  };

  return {
    isSelecting,
    setIsSelecting,
    selectedIds,
    setSelectedIds,
    toggleSelect,
    selectAll,
    deselectAll,
    clearSelection,
    toggleSelectionMode,
  };
}
