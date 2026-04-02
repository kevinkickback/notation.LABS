import { Note, CaretDown } from '@phosphor-icons/react';

interface ComboViewNotesProps {
    notes: string;
    isOpen: boolean;
    onToggle: () => void;
}

export function ComboViewNotes({
    notes,
    isOpen,
    onToggle,
}: ComboViewNotesProps) {
    if (!notes?.trim()) {
        return null;
    }

    return (
        <div className="mb-6 border border-border rounded-lg overflow-hidden">
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-card hover:bg-muted/50 transition-colors"
            >
                <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Note className="w-4 h-4" />
                    Notes
                </span>
                <CaretDown
                    className={`w-4 h-4 text-muted-foreground transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>
            {isOpen && (
                <div className="px-4 py-3 bg-card border-t border-border">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {notes}
                    </p>
                </div>
            )}
        </div>
    );
}
