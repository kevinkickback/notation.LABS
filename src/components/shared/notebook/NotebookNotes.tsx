import { BookOpenIcon, PencilSimpleIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { NotebookEditor } from '@/hooks/useNotebookEditor';
import { NotesMarkdown } from '../NotesMarkdown';
export function NotebookNotes({
  editor,
  notes,
}: {
  editor: NotebookEditor['note'];
  notes: string;
}) {
  const {
    noteActionRef,
    editingNote,
    hasNotes,
    openNoteEditor,
    noteEditorRef,
    saveNote,
    editorTab,
    noteFocusRequested,
    setEditorTab,
    noteId,
    focusNoteInput,
    noteDraft,
    setNoteDraft,
    savingNote,
    finishNoteEditing,
  } = editor;
  const noteAction = !editingNote && (
    <Button
      ref={noteActionRef}
      type="button"
      variant="outline"
      size="sm"
      className="notebook-note-action"
      onClick={openNoteEditor}
      aria-label={hasNotes ? 'Edit note' : 'Add note'}
    >
      <PencilSimpleIcon size={16} />
      {hasNotes ? 'Edit' : 'Add'}
    </Button>
  );

  return (
    <section className="notebook-notes" aria-label="Notes">
      {editingNote ? (
        <form
          ref={noteEditorRef}
          className="notebook-note-editor"
          onSubmit={(event) => {
            event.preventDefault();
            void saveNote();
          }}
        >
          <Tabs
            value={editorTab}
            onValueChange={(value) => {
              noteFocusRequested.current = value === 'write';
              setEditorTab(value);
            }}
          >
            <TabsList aria-label="Note editor mode" className="notebook-tabs">
              <TabsTrigger value="write">Write</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="write">
              <Label htmlFor={noteId} className="sr-only">
                Note
              </Label>
              <Textarea
                ref={focusNoteInput}
                id={noteId}
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                rows={9}
                disabled={savingNote}
                placeholder="Game plan, matchup reminders, practice goals…"
              />
            </TabsContent>
            <TabsContent value="preview" className="notebook-note-preview">
              {noteDraft.trim() ? (
                <NotesMarkdown content={noteDraft} />
              ) : (
                <p className="notebook-empty">
                  Your formatted note will appear here.
                </p>
              )}
            </TabsContent>
          </Tabs>
          <div className="notebook-editor-footer">
            <span>Markdown supported</span>
            <div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => finishNoteEditing()}
                disabled={savingNote}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingNote}
                aria-label="Save Note"
              >
                {savingNote ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </form>
      ) : hasNotes ? (
        <div className="notebook-note-content">
          <div className="notebook-note-tools">{noteAction}</div>
          <NotesMarkdown content={notes} />
        </div>
      ) : (
        <div className="notebook-empty-state">
          <BookOpenIcon size={24} weight="light" />
          <p>Nothing saved yet.</p>
          <span>Keep your game plan and practice reminders here.</span>
          {noteAction}
        </div>
      )}
    </section>
  );
}
