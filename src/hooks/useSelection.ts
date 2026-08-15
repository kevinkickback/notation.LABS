import { useState } from 'react';

export function useSelection() {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = (ids: string[]) => setSelectedIds(new Set(ids));
  const deselectAll = () => setSelectedIds(new Set());
  const clearSelection = () => {
    setSelectedIds(new Set());
    setIsSelecting(false);
  };
  const toggleSelectionMode = () => {
    setIsSelecting((current) => {
      if (current) setSelectedIds(new Set());
      return !current;
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
