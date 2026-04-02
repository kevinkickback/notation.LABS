import { useState } from 'react';
import type { GameSort } from '@/lib/types';

/**
 * Manages game filtering and sorting state
 */
export function useGameFilters() {
	const [showFilters, setShowFilters] = useState(false);
	const [sortBy, setSortBy] = useState<GameSort>('name-asc');
	const [filterSearch, setFilterSearch] = useState('');

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
		hasActiveFilters,
		activeFilterCount,
		clearFilters,
		toggleFilters,
	};
}
