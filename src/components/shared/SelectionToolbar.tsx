import { TrashIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

interface SelectionToolbarProps {
  selectedCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

export function SelectionToolbar({
  selectedCount,
  onSelectAll,
  onDeselectAll,
  onDelete,
  onCancel,
}: SelectionToolbarProps) {
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
