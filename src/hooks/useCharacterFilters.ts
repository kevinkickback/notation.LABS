import { useMemo, useState } from 'react';
import type { Character } from '@/lib/types';

export type CharacterSort = 'name-asc' | 'name-desc' | 'combos' | 'modified';

/**
 * Manages character filtering and sorting state.
 */
export function useCharacterFilters(
  characters: Character[],
  comboCountByChar: Record<string, number>,
  lastModifiedByChar: Record<string, number>,
) {
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<CharacterSort>('name-asc');
  const [filterSearch, setFilterSearch] = useState('');

  const filteredAndSorted = useMemo(() => {
    let result = [...characters];
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'combos':
          return (comboCountByChar[b.id] || 0) - (comboCountByChar[a.id] || 0);
        case 'modified':
          return (
            (lastModifiedByChar[b.id] || 0) - (lastModifiedByChar[a.id] || 0)
          );
        default:
          return 0;
      }
    });

    return result;
  }, [characters, filterSearch, sortBy, comboCountByChar, lastModifiedByChar]);

  const hasActiveFilters = filterSearch !== '' || sortBy !== 'name-asc';
  const activeFilterCount =
    (filterSearch !== '' ? 1 : 0) + (sortBy !== 'name-asc' ? 1 : 0);

  const clearFilters = () => {
    setFilterSearch('');
    setSortBy('name-asc');
  };

  const toggleFilters = () => {
    setShowFilters((prev) => !prev);
  };

  return {
    showFilters,
    setShowFilters,
    sortBy,
    setSortBy,
    filterSearch,
    setFilterSearch,
    filteredAndSorted,
    hasActiveFilters,
    activeFilterCount,
    clearFilters,
    toggleFilters,
  };
}
