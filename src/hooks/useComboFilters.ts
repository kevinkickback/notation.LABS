import { useMemo, useState } from 'react';
import type { Combo } from '@/lib/types';

/**
 * Manages filter state and logic for combos
 */
export function useComboFilters(combos: Combo[]) {
  const [showFilters, setShowFilters] = useState(false);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [filterOutdated, setFilterOutdated] = useState<
    'all' | 'outdated' | 'current'
  >('all');
  const [filterSearch, setFilterSearch] = useState('');

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    combos.forEach((c) => {
      c.tags.forEach((t) => {
        tagSet.add(t);
      });
    });
    return Array.from(tagSet).sort();
  }, [combos]);

  const filteredCombos = useMemo(() => {
    return combos.filter((combo) => {
      if (
        filterTags.length > 0 &&
        !filterTags.every((t) => combo.tags.includes(t))
      )
        return false;
      if (
        filterDifficulty !== 'all' &&
        combo.difficulty !== parseInt(filterDifficulty, 10)
      )
        return false;
      if (filterOutdated === 'outdated' && !combo.outdated) return false;
      if (filterOutdated === 'current' && combo.outdated) return false;
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        const matches =
          combo.name.toLowerCase().includes(q) ||
          combo.notation.toLowerCase().includes(q) ||
          combo.description?.toLowerCase().includes(q) ||
          combo.tags.some((t) => t.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [combos, filterTags, filterDifficulty, filterOutdated, filterSearch]);

  const hasActiveFilters =
    filterTags.length > 0 ||
    filterDifficulty !== 'all' ||
    filterOutdated !== 'all' ||
    filterSearch !== '';

  const activeFilterCount = [
    filterTags.length > 0,
    filterDifficulty !== 'all',
    filterOutdated !== 'all',
    filterSearch !== '',
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilterTags([]);
    setFilterDifficulty('all');
    setFilterOutdated('all');
    setFilterSearch('');
  };

  const toggleFilterTag = (tag: string) => {
    setFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const addFilterTag = (tag: string) => {
    if (!filterTags.includes(tag)) {
      setFilterTags((prev) => [...prev, tag]);
    }
  };

  return {
    showFilters,
    setShowFilters,
    filterTags,
    filterDifficulty,
    filterOutdated,
    filterSearch,
    allTags,
    filteredCombos,
    hasActiveFilters,
    activeFilterCount,
    clearFilters,
    toggleFilterTag,
    addFilterTag,
    setFilterSearch,
    setFilterDifficulty,
    setFilterOutdated,
  };
}
