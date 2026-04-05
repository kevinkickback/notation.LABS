import {
  CheckSquareIcon,
  FunnelIcon,
  ListIcon,
  PaletteIcon,
  PlusIcon,
  SquaresFourIcon,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface CharacterViewToolbarProps {
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  cardSize: number;
  onCardSizeChange: (size: number) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;
  isSelecting: boolean;
  onToggleSelect: () => void;
  onOpenColorDialog: () => void;
  onAddCharacter: () => void;
}

export function CharacterViewToolbar({
  viewMode,
  onViewModeChange,
  cardSize,
  onCardSizeChange,
  showFilters,
  onToggleFilters,
  activeFilterCount,
  isSelecting,
  onToggleSelect,
  onOpenColorDialog,
  onAddCharacter,
}: CharacterViewToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 min-w-0">
      <div
        className={`flex items-center gap-1.5 bg-muted rounded-md px-2.5 h-9 ${viewMode === 'list' ? 'opacity-60 pointer-events-none' : ''}`}
        title={
          viewMode === 'list' ? 'Only available in grid view' : 'Card size'
        }
      >
        <span className="text-xs text-muted-foreground select-none">Size</span>
        <Slider
          min={120}
          max={300}
          step={10}
          value={[cardSize]}
          onValueChange={([v]) => onCardSizeChange(v)}
          className="w-24"
          disabled={viewMode === 'list'}
        />
      </div>
      <div className="flex items-center bg-muted rounded-md">
        <Button
          variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
          className="h-9 px-2 rounded-r-none flex items-center gap-1.5"
          onClick={() => onViewModeChange('grid')}
          title="Grid view"
        >
          <SquaresFourIcon className="w-5 h-5" />
          <span className="text-xs leading-tight">Grid</span>
        </Button>
        <Button
          variant={viewMode === 'list' ? 'secondary' : 'ghost'}
          className="h-9 px-2 rounded-l-none flex items-center gap-1.5"
          onClick={() => onViewModeChange('list')}
          title="List view"
        >
          <ListIcon className="w-5 h-5" />
          <span className="text-xs leading-tight">List</span>
        </Button>
      </div>
      <div className="bg-muted rounded-md">
        <Button
          variant={showFilters ? 'secondary' : 'ghost'}
          onClick={onToggleFilters}
          title="Sort & Filter"
          className="relative flex items-center gap-1.5"
        >
          <FunnelIcon className="w-5 h-5" />
          <span className="text-xs leading-tight">Filter</span>
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] bg-primary text-primary-foreground rounded-full text-[10px] font-bold flex items-center justify-center leading-none px-0.5">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>
      <div className="bg-muted rounded-md">
        <Button
          variant={isSelecting ? 'secondary' : 'ghost'}
          onClick={onToggleSelect}
          title="Multi-select characters"
          className="flex items-center gap-1.5"
        >
          <CheckSquareIcon className="w-5 h-5" />
          <span className="text-xs leading-tight">Select</span>
        </Button>
      </div>
      <div className="bg-muted rounded-md">
        <Button
          variant="ghost"
          onClick={onOpenColorDialog}
          title="Edit button colors"
          className="flex items-center gap-1.5"
        >
          <PaletteIcon className="w-5 h-5" />
          <span className="text-xs leading-tight">Colors</span>
        </Button>
      </div>
      <Button onClick={onAddCharacter} className="gap-2">
        <PlusIcon weight="bold" />
        Add Character
      </Button>
    </div>
  );
}
