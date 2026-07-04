import {
  CaretDownIcon,
  CheckSquareIcon,
  DotsThreeIcon,
  ListIcon,
  MagnifyingGlassIcon,
  PaletteIcon,
  PlusIcon,
  SquaresFourIcon,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import type { CharacterSort } from '@/hooks/useCharacterFilters';

const SORT_LABELS: Record<CharacterSort, string> = {
  'name-asc': 'Name A–Z',
  'name-desc': 'Name Z–A',
  combos: 'Most Combos',
  modified: 'Last Modified',
};

interface CharacterViewToolbarProps {
  filterSearch: string;
  onFilterSearchChange: (value: string) => void;
  sortBy: CharacterSort;
  onSortByChange: (sort: CharacterSort) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  cardSize: number;
  onCardSizeChange: (size: number) => void;
  onToggleSelect: () => void;
  onOpenColorDialog: () => void;
  onAddCharacter: () => void;
}

export function CharacterViewToolbar({
  filterSearch,
  onFilterSearchChange,
  sortBy,
  onSortByChange,
  viewMode,
  onViewModeChange,
  cardSize,
  onCardSizeChange,
  onToggleSelect,
  onOpenColorDialog,
  onAddCharacter,
}: CharacterViewToolbarProps) {
  const isSortActive = sortBy !== 'name-asc';

  return (
    <div className="flex flex-wrap items-center gap-2 min-w-0">
      {/* Search */}
      <div className="relative flex items-center">
        <MagnifyingGlassIcon className="absolute left-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search characters..."
          value={filterSearch}
          onChange={(e) => onFilterSearchChange(e.target.value)}
          className="pl-8 w-48 h-9"
        />
      </div>

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={`relative flex items-center gap-1 bg-muted h-9 px-3 ${isSortActive ? 'text-primary' : ''}`}
          >
            <span className="text-xs">Sort</span>
            <CaretDownIcon className="w-3.5 h-3.5 opacity-60" />
            {isSortActive && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {(Object.entries(SORT_LABELS) as [CharacterSort, string][]).map(
            ([value, label]) => (
              <DropdownMenuItem
                key={value}
                onClick={() => onSortByChange(value)}
                data-active={sortBy === value}
                className="data-[active=true]:bg-accent"
              >
                {label}
              </DropdownMenuItem>
            ),
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* View */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-1 bg-muted h-9 px-3"
          >
            <span className="text-xs">View</span>
            <CaretDownIcon className="w-3.5 h-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52 p-3" align="start">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Layout
              </p>
              <div className="flex items-center bg-muted rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  className="flex-1 h-8 px-2 rounded-r-none flex items-center gap-1.5 text-xs"
                  onClick={() => onViewModeChange('grid')}
                >
                  <SquaresFourIcon className="w-4 h-4" />
                  Grid
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  className="flex-1 h-8 px-2 rounded-l-none flex items-center gap-1.5 text-xs"
                  onClick={() => onViewModeChange('list')}
                >
                  <ListIcon className="w-4 h-4" />
                  List
                </Button>
              </div>
            </div>
            {viewMode === 'grid' && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  Card Size
                </p>
                <Slider
                  min={120}
                  max={300}
                  step={10}
                  value={[cardSize]}
                  onValueChange={([v]) => onCardSizeChange(v)}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Overflow */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="bg-muted h-9 px-2.5"
            aria-label="More options"
          >
            <DotsThreeIcon className="w-5 h-5" weight="bold" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={onToggleSelect}
            className="flex items-center gap-2"
          >
            <CheckSquareIcon className="w-4 h-4" />
            Select Characters
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onOpenColorDialog}
            className="flex items-center gap-2"
          >
            <PaletteIcon className="w-4 h-4" />
            Edit Game Buttons
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Primary action */}
      <Button onClick={onAddCharacter} className="gap-2">
        <PlusIcon weight="bold" />
        Add Character
      </Button>
    </div>
  );
}
