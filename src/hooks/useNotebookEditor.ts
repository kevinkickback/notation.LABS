import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useSubmission } from '@/hooks/useSubmission';
import { updateCharacter } from '@/lib/application/characterCommands';
import { updateGame } from '@/lib/application/gameCommands';
import { reportError } from '@/lib/errors';
import { externalHttpsUrlSchema } from '@/lib/schemas';
import type { CharacterLink } from '@/lib/types';
import { hasModalOverlay } from '@/lib/uiFocus';

export type NotebookEntity = { entityId: string; notes: string } & (
  | { kind: 'game'; links?: never }
  | { kind: 'character'; links: CharacterLink[] }
);
interface ResourceDraft {
  id?: string;
  url: string;
  label: string;
}
export function getResourceDomain(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function useNotebookEditor(
  props: NotebookEntity & { isOpen: boolean; onToggle: () => void },
) {
  const { entityId, notes, isOpen, onToggle } = props;
  const links = props.links ?? [];
  const [activeTab, setActiveTab] = useState('notes');
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(notes);
  const [editorTab, setEditorTab] = useState('write');
  const { pending: savingNote, submit: submitNote } = useSubmission(
    isOpen && editingNote,
    `${props.kind}:${entityId}`,
  );
  const [resourceDraft, setResourceDraft] = useState<ResourceDraft | null>(
    null,
  );
  const { pending: savingResource, submit: submitResource } = useSubmission(
    isOpen && props.kind === 'character',
    entityId,
  );
  const [urlError, setUrlError] = useState<string | null>(null);
  const noteActionRef = useRef<HTMLButtonElement>(null);
  const resourceActionRef = useRef<HTMLButtonElement>(null);
  const noteEditorRef = useRef<HTMLFormElement>(null);
  const resourceEditorRef = useRef<HTMLFormElement>(null);
  const resourceEditorOpenerRef = useRef<HTMLButtonElement | null>(null);
  const noteActionFocusRequested = useRef(false);
  const resourceActionFocusRequested = useRef(false);
  const [removedResource, setRemovedResource] = useState<{
    id: string;
    opener: HTMLElement;
  } | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const noteFocusRequested = useRef(false);
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const resourceFocusRequested = useRef(false);
  const noteId = useId();
  const urlId = useId();
  const labelId = useId();
  const errorId = useId();
  const hasNotes = Boolean(notes.trim());

  const focusNoteInput = useCallback((input: HTMLTextAreaElement | null) => {
    noteInputRef.current = input;
    if (!input || !noteFocusRequested.current) return;
    noteFocusRequested.current = false;
    if (!hasModalOverlay()) input.focus();
  }, []);
  const focusResourceInput = useCallback((input: HTMLInputElement | null) => {
    if (!input || !resourceFocusRequested.current) return;
    resourceFocusRequested.current = false;
    if (!hasModalOverlay()) input.focus();
  }, []);

  useEffect(() => {
    if (!editingNote && noteActionFocusRequested.current) {
      noteActionFocusRequested.current = false;
      if (!hasModalOverlay()) noteActionRef.current?.focus();
    }
    if (!resourceDraft && resourceActionFocusRequested.current) {
      resourceActionFocusRequested.current = false;
      const opener = resourceEditorOpenerRef.current;
      if (!hasModalOverlay())
        (opener?.isConnected ? opener : resourceActionRef.current)?.focus();
    }
  }, [editingNote, resourceDraft]);

  useEffect(() => {
    if (
      removedResource &&
      !links.some((link) => link.id === removedResource.id)
    ) {
      setRemovedResource(null);
      if (
        !removedResource.opener.isConnected &&
        document.activeElement === document.body &&
        !hasModalOverlay()
      )
        resourceActionRef.current?.focus();
    }
  }, [links, removedResource]);

  const finishNoteEditing = (
    restoreFocus = Boolean(
      noteEditorRef.current?.contains(document.activeElement),
    ),
  ) => {
    noteActionFocusRequested.current =
      restoreFocus &&
      (document.activeElement === document.body ||
        Boolean(noteEditorRef.current?.contains(document.activeElement)));
    setEditingNote(false);
  };
  const finishResourceEditing = (
    restoreFocus = Boolean(
      resourceEditorRef.current?.contains(document.activeElement),
    ),
  ) => {
    resourceActionFocusRequested.current =
      restoreFocus &&
      (document.activeElement === document.body ||
        Boolean(resourceEditorRef.current?.contains(document.activeElement)));
    setResourceDraft(null);
    setUrlError(null);
  };

  const openNoteEditor = () => {
    noteFocusRequested.current = true;
    if (noteInputRef.current) {
      noteFocusRequested.current = false;
      if (!hasModalOverlay()) noteInputRef.current.focus();
    }
    if (!isOpen)
      openerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    if (!editingNote) setNoteDraft(notes);
    setEditingNote(true);
    setEditorTab('write');
    setActiveTab('notes');
    if (!isOpen) onToggle();
  };

  const openResourceEditor = (link?: CharacterLink) => {
    if (props.kind !== 'character') return;
    resourceFocusRequested.current = true;
    resourceEditorOpenerRef.current =
      document.activeElement instanceof HTMLButtonElement
        ? document.activeElement
        : null;
    if (!isOpen)
      openerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    if (link || !resourceDraft)
      setResourceDraft(link ?? { url: '', label: '' });
    setUrlError(null);
    setActiveTab('resources');
    if (!isOpen) onToggle();
  };

  const saveNote = async () => {
    const restoreFocus = Boolean(
      noteEditorRef.current?.contains(document.activeElement),
    );
    await submitNote(
      async () => {
        const updates = { notes: noteDraft.trim() };
        if (props.kind === 'game') await updateGame(entityId, updates);
        else await updateCharacter(entityId, updates);
      },
      {
        onSuccess: () => {
          finishNoteEditing(restoreFocus);
          toast.success('Note updated');
        },
        onError: (error) => {
          reportError('EntityNotebook.saveNote', error);
          toast.error('Failed to update note');
        },
      },
    );
  };

  const saveResource = async () => {
    if (!resourceDraft || props.kind !== 'character') return;
    const raw = resourceDraft.url.trim();
    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw)
      ? raw
      : `https://${raw}`;
    const result = externalHttpsUrlSchema.safeParse(candidate);
    if (!result.success) {
      setUrlError('Enter a valid HTTPS URL without credentials.');
      return;
    }
    const link: CharacterLink = {
      id: resourceDraft.id ?? crypto.randomUUID(),
      url: result.data,
      label: resourceDraft.label.trim() || getResourceDomain(result.data),
    };
    const restoreFocus = Boolean(
      resourceEditorRef.current?.contains(document.activeElement),
    );
    await submitResource(
      async () => {
        await updateCharacter(entityId, {
          links: resourceDraft.id
            ? links.map((item) => (item.id === link.id ? link : item))
            : [...links, link],
        });
      },
      {
        onSuccess: () => finishResourceEditing(restoreFocus),
        onError: (error) => {
          reportError('EntityNotebook.saveResource', error);
          toast.error('Failed to save resource');
        },
      },
    );
  };

  const removeResource = async (id: string) => {
    if (props.kind !== 'character') return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    await submitResource(
      async () => {
        await updateCharacter(entityId, {
          links: links.filter((link) => link.id !== id),
        });
      },
      {
        onSuccess: () => {
          if (opener) setRemovedResource({ id, opener });
        },
        onError: (error) => {
          reportError('EntityNotebook.removeResource', error);
          toast.error('Failed to remove resource');
        },
      },
    );
  };

  return {
    activeTab,
    setActiveTab,
    openerRef,
    note: {
      editingNote,
      noteDraft,
      setNoteDraft,
      editorTab,
      setEditorTab,
      savingNote,
      noteActionRef,
      noteEditorRef,
      noteFocusRequested,
      noteId,
      hasNotes,
      focusNoteInput,
      finishNoteEditing,
      openNoteEditor,
      saveNote,
    },
    resources: {
      resourceDraft,
      setResourceDraft,
      savingResource,
      urlError,
      setUrlError,
      resourceActionRef,
      resourceEditorRef,
      urlId,
      labelId,
      errorId,
      focusResourceInput,
      finishResourceEditing,
      openResourceEditor,
      saveResource,
      removeResource,
    },
  };
}
export type NotebookEditor = ReturnType<typeof useNotebookEditor>;
