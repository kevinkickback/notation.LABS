import { X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { GameSort } from '@/lib/types';

interface GameLibraryFilterPanelProps {
    filterSearch: string;
    onFilterSearchChange: (search: string) => void;
    sortBy: GameSort;
    onSortByChange: (sort: GameSort) => void;
    hasActiveFilters: boolean;
    onClearFilters: () => void;
    filteredCount: number;
    totalCount: number;
}

export function GameLibraryFilterPanel({
    filterSearch,
    onFilterSearchChange,
    sortBy,
    onSortByChange,
    hasActiveFilters,
    onClearFilters,
    filteredCount,
    totalCount,
}: GameLibraryFilterPanelProps) {
    return (
        <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-card border border-border rounded-lg">
            <Input
                placeholder="Search games..."
                value={filterSearch}
                onChange={(e) => onFilterSearchChange(e.target.value)}
                className="w-48"
            />
            <Select value={sortBy} onValueChange={(v) => onSortByChange(v as GameSort)}>
                <SelectTrigger className="w-44">
                    <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="name-asc">Name A–Z</SelectItem>
                    <SelectItem value="name-desc">Name Z–A</SelectItem>
                    <SelectItem value="characters">Most Characters</SelectItem>
                    <SelectItem value="combos">Most Combos</SelectItem>
                    <SelectItem value="modified">Last Modified</SelectItem>
                </SelectContent>
            </Select>
            {hasActiveFilters && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearFilters}
                    className="gap-1"
                >
                    <X className="w-4 h-4" />
                    Clear
                </Button>
            )}
            {filterSearch && (
                <span className="text-sm text-muted-foreground ml-auto">
                    {filteredCount} of {totalCount} games
                </span>
            )}
        </div>
    );
}
