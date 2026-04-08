import { CaretDownIcon, NoteIcon, NotePencilIcon } from '@phosphor-icons/react';
import { NotesMarkdown } from '@/components/shared/NotesMarkdown';
import { Button } from '@/components/ui/button';

interface ComboViewNotesProps {
  notes: string;
  isOpen: boolean;
  onToggle: () => void;
  onEditNote?: () => void;
}

export function ComboViewNotes({
  notes,
  isOpen,
  onToggle,
  onEditNote,
}: ComboViewNotesProps) {
  if (!notes?.trim()) {
    return null;
  }

  return (
    <div className="mb-6 border border-border rounded-lg overflow-hidden">
      <div className="w-full flex items-center justify-between gap-2 px-2 py-1.5 bg-card border-b border-border">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 min-w-0 flex items-center justify-between px-2 py-1 rounded hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <NoteIcon className="w-4 h-4" />
            Notes
          </span>
          <CaretDownIcon
            className={`w-4 h-4 text-muted-foreground transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onEditNote?.()}
          title="Edit note"
          className="h-8 px-2"
        >
          <NotePencilIcon className="w-4 h-4" />
          <span className="sr-only">Edit note</span>
        </Button>
      </div>
      {isOpen && (
        <div className="px-4 py-3 bg-card">
          <NotesMarkdown content={notes} />
        </div>
      )}
    </div>
  );
}
