import {
  CheckSquareIcon,
  DotsThreeIcon,
  FunnelIcon,
  PaletteIcon,
  PlusIcon,
} from '@phosphor-icons/react';
import { DisplayModeToggle } from '@/components/combo/DisplayModeToggle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DisplayMode } from '@/lib/types';

interface ComboViewToolbarProps {
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => Promise<void>;
  showFilters: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;
  isSelecting: boolean;
  onToggleSelect: () => void;
  onAddCombo: () => void;
  onOpenColorDialog: () => void;
}

export function ComboViewToolbar({
  displayMode,
  onDisplayModeChange,
  showFilters,
  onToggleFilters,
  activeFilterCount,
  isSelecting,
  onToggleSelect,
  onAddCombo,
  onOpenColorDialog,
}: ComboViewToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 min-w-0">
      <div className="bg-muted rounded-md">
        <DisplayModeToggle mode={displayMode} onChange={onDisplayModeChange} />
      </div>
      <div className="bg-muted rounded-md">
        <Button
          variant={showFilters ? 'secondary' : 'ghost'}
          onClick={onToggleFilters}
          title="Filter Combos"
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

      {/* Overflow */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={isSelecting ? 'secondary' : 'ghost'}
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
            Select Combos
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

      <Button onClick={onAddCombo} className="gap-2">
        <PlusIcon weight="bold" />
        Add Combo
      </Button>
    </div>
  );
}
