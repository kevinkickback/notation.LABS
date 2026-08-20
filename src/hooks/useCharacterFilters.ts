import { useMemo, useState } from 'react';
import { compareEntityNames, compareFavoritesFirst } from '@/lib/entitySorting';
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
      const query = filterSearch.toLowerCase();
      result = result.filter((character) =>
        character.name.toLowerCase().includes(query),
      );
    }

    result.sort((left, right) => {
      const favoriteOrder = compareFavoritesFirst(left, right);
      if (favoriteOrder !== 0) return favoriteOrder;

      let sortOrder: number;
      switch (sortBy) {
        case 'name-asc':
          sortOrder = compareEntityNames(left, right);
          break;
        case 'name-desc':
          sortOrder = compareEntityNames(right, left);
          break;
        case 'combos':
          sortOrder =
            (comboCountByChar[right.id] || 0) -
            (comboCountByChar[left.id] || 0);
          break;
        case 'modified':
          sortOrder =
            (lastModifiedByChar[right.id] || 0) -
            (lastModifiedByChar[left.id] || 0);
          break;
        default:
          sortOrder = 0;
      }
      return sortOrder || compareEntityNames(left, right);
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
    setShowFilters((previous) => !previous);
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
