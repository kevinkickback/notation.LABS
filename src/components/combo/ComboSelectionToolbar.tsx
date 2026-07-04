import { TrashIcon, WarningIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

interface ComboSelectionToolbarProps {
  selectedCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onMarkOutdated: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

export function ComboSelectionToolbar({
  selectedCount,
  onSelectAll,
  onDeselectAll,
  onMarkOutdated,
  onDelete,
  onCancel,
}: ComboSelectionToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 min-w-0 w-full sm:w-auto">
      <span className="text-sm font-medium text-muted-foreground">
        {selectedCount} selected
      </span>
      <Button variant="ghost" size="sm" className="h-9" onClick={onSelectAll}>
        Select All
      </Button>
      {selectedCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={onDeselectAll}
        >
          Deselect All
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 h-9 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
        disabled={selectedCount === 0}
        onClick={onMarkOutdated}
      >
        <WarningIcon className="w-4 h-4" />
        Mark Outdated
      </Button>
      <Button
        variant="destructive"
        size="sm"
        className="gap-1.5 h-9"
        disabled={selectedCount === 0}
        onClick={onDelete}
      >
        <TrashIcon className="w-4 h-4" />
        Delete
      </Button>
      <Button variant="outline" size="sm" className="h-9" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
