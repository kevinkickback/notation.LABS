import { Trash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

interface SelectionToolbarProps {
    selectedCount: number;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    onDelete: () => void;
}

export function SelectionToolbar({
    selectedCount,
    onSelectAll,
    onDeselectAll,
    onDelete,
}: SelectionToolbarProps) {
    return (
        <div className="flex items-center justify-between mb-4 p-3 bg-secondary rounded-lg">
            <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{selectedCount} selected</span>
                <Button variant="ghost" size="sm" onClick={onSelectAll}>
                    Select All
                </Button>
                {selectedCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={onDeselectAll}>
                        Deselect All
                    </Button>
                )}
            </div>
            <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                disabled={selectedCount === 0}
                onClick={onDelete}
            >
                <Trash className="w-4 h-4" />
                Delete ({selectedCount})
            </Button>
        </div>
    );
}
