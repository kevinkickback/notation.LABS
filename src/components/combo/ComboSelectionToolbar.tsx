import { Trash, Warning } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

interface ComboSelectionToolbarProps {
    selectedCount: number;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    onMarkOutdated: () => void;
    onDelete: () => void;
}

export function ComboSelectionToolbar({
    selectedCount,
    onSelectAll,
    onDeselectAll,
    onMarkOutdated,
    onDelete,
}: ComboSelectionToolbarProps) {
    return (
        <div className="flex items-center justify-between mb-4 p-3 bg-secondary rounded-lg">
            <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                    {selectedCount} selected
                </span>
                <Button variant="ghost" size="sm" onClick={onSelectAll}>
                    Select All
                </Button>
                {selectedCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={onDeselectAll}>
                        Deselect All
                    </Button>
                )}
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                    disabled={selectedCount === 0}
                    onClick={onMarkOutdated}
                >
                    <Warning className="w-4 h-4" />
                    Mark Outdated ({selectedCount})
                </Button>
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
        </div>
    );
}
