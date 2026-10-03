import {
  ArrowSquareOutIcon,
  BookOpenIcon,
  LinkSimpleIcon,
  PencilSimpleIcon,
  PlusIcon,
  SidebarSimpleIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react';
import {
  type CSSProperties,
  createContext,
  forwardRef,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useSettings, useSettingsActions } from '@/context/SettingsContext';
import { updateCharacter } from '@/lib/application/characterCommands';
import { updateGame } from '@/lib/application/gameCommands';
import { reportError } from '@/lib/errors';
import { externalHttpUrlSchema } from '@/lib/schemas';
import type { CharacterLink } from '@/lib/types';
import { NotesMarkdown } from './NotesMarkdown';

const MIN_DOCK_WIDTH = 320;
const DEFAULT_DOCK_WIDTH = 400;
const MAX_DOCK_WIDTH = 600;
const NotebookDock = createContext<{
  target: HTMLDivElement | null;
  portalContainer: HTMLDivElement | null;
  triggerTarget: HTMLDivElement | null;
  setTriggerTarget: (target: HTMLDivElement | null) => void;
  width: number;
  maxWidth: number;
  setWidth: (width: number) => void;
  saveWidth: (width: number) => void;
  cancelWidth: () => void;
} | null>(null);

export function NotebookWorkspace({ children }: { children: ReactNode }) {
  const { notebookDockWidth = DEFAULT_DOCK_WIDTH } = useSettings();
  const { setSetting } = useSettingsActions();
  const [dockTarget, setDockTarget] = useState<HTMLDivElement | null>(null);
  const [triggerTarget, setTriggerTarget] = useState<HTMLDivElement | null>(
    null,
  );
  const [workspace, setWorkspace] = useState<HTMLDivElement | null>(null);
  const [workspaceWidth, setWorkspaceWidth] = useState(0);
  const [mainWidth, setMainWidth] = useState(0);
  const [dockHeight, setDockHeight] = useState(0);
  const [draftWidth, setDraftWidth] = useState<number | null>(null);
  const cancelWidth = useCallback(() => setDraftWidth(null), []);
  const maxWidth =
    workspaceWidth > 0
      ? Math.max(
          MIN_DOCK_WIDTH,
          Math.min(MAX_DOCK_WIDTH, workspaceWidth - 460 - 28),
        )
      : MAX_DOCK_WIDTH;
  const width = Math.min(draftWidth ?? notebookDockWidth, maxWidth);
  const clampWidth = (value: number) =>
    Math.round(Math.max(MIN_DOCK_WIDTH, Math.min(maxWidth, value)));
  useEffect(() => {
    if (!workspace) return;
    const container = workspace.parentElement;
    const measure = () => {
      setWorkspaceWidth(workspace.getBoundingClientRect().width);
      if (container) {
        const style = getComputedStyle(container);
        setMainWidth(
          container.clientWidth -
            (Number.parseFloat(style.paddingLeft) || 0) -
            (Number.parseFloat(style.paddingRight) || 0),
        );
        const top = workspace.getBoundingClientRect().top + window.scrollY;
        const footerHeight =
          container.nextElementSibling?.getBoundingClientRect().height ?? 0;
        setDockHeight(
          Math.max(
            0,
            Math.floor(
              window.innerHeight -
                top -
                footerHeight -
                (Number.parseFloat(style.paddingBottom) || 0),
            ),
          ),
        );
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(workspace);
    if (container) observer.observe(container);
    if (container?.nextElementSibling)
      observer.observe(container.nextElementSibling);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [workspace]);
  return (
    <NotebookDock.Provider
      value={{
        target: dockTarget,
        portalContainer: workspace,
        triggerTarget,
        setTriggerTarget,
        width,
        maxWidth,
        setWidth: (value) => setDraftWidth(clampWidth(value)),
        saveWidth: (value) => {
          setDraftWidth(null);
          void setSetting('notebookDockWidth', clampWidth(value));
        },
        cancelWidth,
      }}
    >
      <div
        className="notebook-workspace"
        ref={setWorkspace}
        style={
          {
            '--notebook-dock-width': `${width}px`,
            '--notebook-main-width':
              mainWidth > 0 ? `${mainWidth}px` : undefined,
            '--notebook-max-dock-width': `${MAX_DOCK_WIDTH}px`,
            '--notebook-dock-height': `${dockHeight}px`,
          } as CSSProperties
        }
      >
        <div className="notebook-main">{children}</div>
        <div className="notebook-dock-host" ref={setDockTarget} />
      </div>
    </NotebookDock.Provider>
  );
}

export function NotebookTriggerSlot() {
  const workspace = useContext(NotebookDock);
  return workspace ? (
    <div className="notebook-trigger-slot" ref={workspace.setTriggerTarget} />
  ) : null;
}

export interface EntityNotebookRef {
  editNote: () => void;
}

type EntityNotebookProps = {
  entityId: string;
  entityName: string;
  notes: string;
  isOpen: boolean;
  onToggle: () => void;
  hideTrigger?: boolean;
} & (
  | { kind: 'game'; links?: never }
  | { kind: 'character'; links: CharacterLink[] }
);

interface ResourceDraft {
  id?: string;
  url: string;
  label: string;
}

function hasModalOverlay() {
  return Boolean(
    document.querySelector(
      '[data-slot="dialog-overlay"], [data-slot="alert-dialog-overlay"]',
    ),
  );
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function ResourceFavicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  let source: string | null = null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:')
      source = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=32`;
  } catch {
    // Keep the resource usable if an older link has an invalid URL.
  }
  return (
    <span className="notebook-resource-favicon" aria-hidden="true">
      {source && !failed ? (
        <img
          src={source}
          alt=""
          width={20}
          height={20}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <LinkSimpleIcon size={20} />
      )}
    </span>
  );
}

export const EntityNotebook = forwardRef<
  EntityNotebookRef,
  EntityNotebookProps
>(function EntityNotebook(props, ref) {
  const {
    entityId,
    entityName,
    notes,
    isOpen,
    onToggle,
    hideTrigger = false,
  } = props;
  const links = props.links ?? [];
  const dock = useContext(NotebookDock);
  const dockTarget = dock?.target;
  const cancelWidth = dock?.cancelWidth;
  const { notebookDocked: dockRequested = false } = useSettings();
  const { setSetting } = useSettingsActions();
  const [wideWindow, setWideWindow] = useState(
    () => window.matchMedia('(min-width: 1100px)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1100px)');
    const handleChange = (event: MediaQueryListEvent) =>
      setWideWindow(event.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);
  const isDocked = dockRequested && wideWindow && Boolean(dockTarget);
  const [resizing, setResizing] = useState(false);
  const resizeStart = useRef<{
    pointerId: number;
    x: number;
    width: number;
  } | null>(null);
  useEffect(() => {
    if (!isDocked || !isOpen) {
      resizeStart.current = null;
      setResizing(false);
      cancelWidth?.();
    }
  }, [isDocked, isOpen, cancelWidth]);
  const [activeTab, setActiveTab] = useState('notes');
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(notes);
  const [editorTab, setEditorTab] = useState('write');
  const [savingNote, setSavingNote] = useState(false);
  const [resourceDraft, setResourceDraft] = useState<ResourceDraft | null>(
    null,
  );
  const [savingResource, setSavingResource] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const contentId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const dockControlRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const panelFocusRequested = useRef(false);
  const dockFocusRequested = useRef(false);
  const returnFocusRequested = useRef(false);
  const previousOpen = useRef(isOpen);
  const noteFocusRequested = useRef(false);
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const resourceFocusRequested = useRef(false);
  const titleId = useId();
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
    const closed = previousOpen.current && !isOpen;
    previousOpen.current = isOpen;
    if (
      closed &&
      isDocked &&
      document.activeElement === document.body &&
      !hasModalOverlay()
    )
      (toggleRef.current ?? openerRef.current)?.focus();
    if (!isDocked || !isOpen) return;
    if (panelFocusRequested.current || dockFocusRequested.current) {
      panelFocusRequested.current = false;
      dockFocusRequested.current = false;
      if (!hasModalOverlay()) dockControlRef.current?.focus();
    }
  }, [isDocked, isOpen]);

  const closeNotebook = () => {
    panelFocusRequested.current = false;
    dockFocusRequested.current = false;
    returnFocusRequested.current = !isDocked;
    onToggle();
    (toggleRef.current ?? openerRef.current)?.focus();
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

  useImperativeHandle(ref, () => ({
    editNote: openNoteEditor,
  }));

  const saveNote = async () => {
    if (savingNote) return;
    setSavingNote(true);
    try {
      const updates = { notes: noteDraft.trim() };
      if (props.kind === 'game') await updateGame(entityId, updates);
      else await updateCharacter(entityId, updates);
      setEditingNote(false);
      toast.success('Note updated');
    } catch (error) {
      reportError('EntityNotebook.saveNote', error);
      toast.error('Failed to update note');
    } finally {
      setSavingNote(false);
    }
  };

  const saveResource = async () => {
    if (!resourceDraft || savingResource || props.kind !== 'character') return;
    const raw = resourceDraft.url.trim();
    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw)
      ? raw
      : `https://${raw}`;
    const result = externalHttpUrlSchema.safeParse(candidate);
    if (!result.success) {
      setUrlError('Enter a valid HTTP or HTTPS URL without credentials.');
      return;
    }
    const link: CharacterLink = {
      id: resourceDraft.id ?? crypto.randomUUID(),
      url: result.data,
      label: resourceDraft.label.trim() || getDomain(result.data),
    };
    setSavingResource(true);
    try {
      await updateCharacter(entityId, {
        links: resourceDraft.id
          ? links.map((item) => (item.id === link.id ? link : item))
          : [...links, link],
      });
      setResourceDraft(null);
      setUrlError(null);
    } catch (error) {
      reportError('EntityNotebook.saveResource', error);
      toast.error('Failed to save resource');
    } finally {
      setSavingResource(false);
    }
  };

  const removeResource = async (id: string) => {
    if (savingResource || props.kind !== 'character') return;
    setSavingResource(true);
    try {
      await updateCharacter(entityId, {
        links: links.filter((link) => link.id !== id),
      });
    } catch (error) {
      reportError('EntityNotebook.removeResource', error);
      toast.error('Failed to remove resource');
    } finally {
      setSavingResource(false);
    }
  };

  const noteAction = !editingNote && (
    <Button
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

  const notesPane = (
    <section className="notebook-notes" aria-label="Notes">
      {editingNote ? (
        <form
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
                onClick={() => setEditingNote(false)}
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

  const resourceAction = !resourceDraft && (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="notebook-resource-action"
      onClick={() => openResourceEditor()}
      disabled={savingResource}
      aria-label="Add resource link"
    >
      <PlusIcon size={16} />
      Add
    </Button>
  );

  const resourcesPane = (
    <section className="notebook-resources" aria-label="Resources">
      {links.length > 0 && resourceAction && (
        <div className="notebook-resource-tools">{resourceAction}</div>
      )}
      {resourceDraft && (
        <form
          className="notebook-resource-editor"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void saveResource();
          }}
        >
          <div>
            <Label htmlFor={urlId}>URL</Label>
            <Input
              ref={focusResourceInput}
              id={urlId}
              type="url"
              placeholder="https://dustloop.com/…"
              value={resourceDraft.url}
              onChange={(event) => {
                setResourceDraft({ ...resourceDraft, url: event.target.value });
                setUrlError(null);
              }}
              disabled={savingResource}
              aria-invalid={Boolean(urlError)}
              aria-describedby={urlError ? errorId : undefined}
            />
          </div>
          {urlError && (
            <p id={errorId} role="alert" className="notebook-url-error">
              {urlError}
            </p>
          )}
          <div>
            <Label htmlFor={labelId}>
              Label <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id={labelId}
              placeholder="Dustloop Wiki"
              value={resourceDraft.label}
              onChange={(event) =>
                setResourceDraft({
                  ...resourceDraft,
                  label: event.target.value,
                })
              }
              disabled={savingResource}
            />
          </div>
          <div className="notebook-resource-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setResourceDraft(null);
                setUrlError(null);
              }}
              disabled={savingResource}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={savingResource || !resourceDraft.url.trim()}
              aria-label={resourceDraft.id ? 'Save resource' : 'Add resource'}
            >
              {savingResource ? 'Saving…' : resourceDraft.id ? 'Save' : 'Add'}
            </Button>
          </div>
        </form>
      )}
      {links.length ? (
        <ul className="notebook-resource-list">
          {links.map((link) => (
            <li key={link.id}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${link.label} in a new tab`}
              >
                <ResourceFavicon key={link.url} url={link.url} />
                <span className="notebook-resource-label">
                  <strong>{link.label}</strong>
                  <small>{getDomain(link.url)}</small>
                </span>
                <ArrowSquareOutIcon size={14} />
              </a>
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${link.label}`}
                  onClick={() => openResourceEditor(link)}
                  disabled={Boolean(resourceDraft) || savingResource}
                >
                  <PencilSimpleIcon size={16} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="notebook-remove-resource"
                  aria-label={`Remove ${link.label}`}
                  onClick={() => void removeResource(link.id)}
                  disabled={Boolean(resourceDraft) || savingResource}
                >
                  <TrashIcon size={16} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        !resourceDraft && (
          <div className="notebook-empty-state">
            <LinkSimpleIcon size={24} weight="light" />
            <p>Nothing saved yet.</p>
            <span>Save guides, frame data, and videos for this character.</span>
            {resourceAction}
          </div>
        )
      )}
    </section>
  );

  const dockControl =
    wideWindow && dockTarget ? (
      <Button
        ref={dockControlRef}
        type="button"
        variant="ghost"
        size="icon"
        className="notebook-panel-icon"
        aria-label={dockRequested ? 'Undock' : 'Dock'}
        title={dockRequested ? 'Undock' : 'Dock'}
        onClick={() => {
          dockFocusRequested.current = true;
          void setSetting('notebookDocked', !dockRequested);
        }}
      >
        <SidebarSimpleIcon size={16} />
      </Button>
    ) : null;

  const panelTools = (
    <div className="notebook-panel-tools">
      {dockControl}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="notebook-panel-icon"
        aria-label={isDocked ? 'Close notebook' : 'Close'}
        title="Close notebook"
        onClick={closeNotebook}
      >
        <XIcon size={18} />
      </Button>
    </div>
  );

  const notebookBody =
    props.kind === 'character' ? (
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="notebook-panel-content"
      >
        <div className="notebook-panel-toolbar">
          <TabsList
            aria-label="Notebook section"
            className="notebook-section-tabs"
          >
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="resources">
              Resources{' '}
              <span className="notebook-resource-count">({links.length})</span>
            </TabsTrigger>
          </TabsList>
          {panelTools}
        </div>
        <DialogBody>
          <TabsContent value="notes">{notesPane}</TabsContent>
          <TabsContent value="resources">{resourcesPane}</TabsContent>
        </DialogBody>
      </Tabs>
    ) : (
      <div className="notebook-panel-content">
        <div className="notebook-panel-toolbar">
          <h2 className="notebook-panel-label">
            <BookOpenIcon size={16} />
            Notes
          </h2>
          {panelTools}
        </div>
        <DialogBody>{notesPane}</DialogBody>
      </div>
    );

  const trigger = !hideTrigger && (
    <div className="notebook-summary">
      <Button
        ref={toggleRef}
        type="button"
        variant={isOpen ? 'secondary' : 'ghost'}
        className="notebook-toggle"
        onClick={() => {
          if (isOpen) closeNotebook();
          else {
            panelFocusRequested.current = true;
            onToggle();
          }
        }}
        aria-expanded={isOpen}
        aria-controls={isOpen ? contentId : undefined}
        aria-haspopup={!isDocked ? 'dialog' : undefined}
      >
        <BookOpenIcon size={19} />
        <span>{props.kind === 'game' ? 'Notes' : 'Notes & Resources'}</span>
      </Button>
    </div>
  );

  return (
    <div
      className="entity-notebook"
      data-hide-trigger={hideTrigger}
      data-toolbar-trigger={Boolean(dock?.triggerTarget)}
    >
      {dock?.triggerTarget
        ? createPortal(trigger, dock.triggerTarget)
        : trigger}
      {isDocked &&
        isOpen &&
        dockTarget &&
        createPortal(
          <aside
            className="notebook-docked"
            id={contentId}
            aria-labelledby={titleId}
            data-resizing={resizing}
          >
            {dock && (
              <hr
                tabIndex={0}
                className="notebook-resize-handle"
                aria-label="Notebook width"
                aria-orientation="vertical"
                aria-valuemin={MIN_DOCK_WIDTH}
                aria-valuemax={dock.maxWidth}
                aria-valuenow={dock.width}
                aria-valuetext={`${dock.width} pixels`}
                title="Drag to resize, use arrow keys, or double-click to reset"
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.currentTarget.focus();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  resizeStart.current = {
                    pointerId: event.pointerId,
                    x: event.clientX,
                    width: dock.width,
                  };
                  setResizing(true);
                }}
                onPointerMove={(event) => {
                  const start = resizeStart.current;
                  if (start?.pointerId === event.pointerId)
                    dock.setWidth(start.width + start.x - event.clientX);
                }}
                onPointerUp={(event) => {
                  const start = resizeStart.current;
                  if (start?.pointerId !== event.pointerId) return;
                  resizeStart.current = null;
                  // Persist the final choice once, rather than every drag frame.
                  dock.saveWidth(start.width + start.x - event.clientX);
                  if (event.currentTarget.hasPointerCapture(event.pointerId))
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  setResizing(false);
                }}
                onPointerCancel={() => {
                  resizeStart.current = null;
                  setResizing(false);
                  dock.cancelWidth();
                }}
                onLostPointerCapture={() => {
                  resizeStart.current = null;
                  setResizing(false);
                  dock.cancelWidth();
                }}
                onDoubleClick={() => dock.saveWidth(DEFAULT_DOCK_WIDTH)}
                onKeyDown={(event) => {
                  const step = event.shiftKey ? 50 : 20;
                  if (event.key === 'ArrowLeft')
                    dock.saveWidth(dock.width + step);
                  else if (event.key === 'ArrowRight')
                    dock.saveWidth(dock.width - step);
                  else if (event.key === 'Home') dock.saveWidth(MIN_DOCK_WIDTH);
                  else if (event.key === 'End') dock.saveWidth(dock.maxWidth);
                  else return;
                  event.preventDefault();
                }}
              />
            )}
            <h2 className="sr-only" id={titleId}>
              {entityName} Notebook
            </h2>
            {notebookBody}
          </aside>,
          dockTarget,
        )}
      {!isDocked && (!dock || dock.portalContainer) && (
        <Dialog
          modal={false}
          open={isOpen}
          onOpenChange={(open) => {
            if (open !== isOpen) {
              if (open) {
                panelFocusRequested.current = true;
                onToggle();
              } else closeNotebook();
            }
          }}
        >
          <DialogContent
            className="notebook-drawer"
            portalContainer={dock?.portalContainer}
            hideCloseButton
            id={contentId}
            onOpenAutoFocus={(event) => {
              if (dockFocusRequested.current) {
                event.preventDefault();
                dockFocusRequested.current = false;
                if (!hasModalOverlay()) dockControlRef.current?.focus();
              } else if (!panelFocusRequested.current || hasModalOverlay()) {
                event.preventDefault();
              }
              panelFocusRequested.current = false;
            }}
            onInteractOutside={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (
                returnFocusRequested.current ||
                (!isOpen && document.activeElement === document.body)
              ) {
                returnFocusRequested.current = false;
                if (!hasModalOverlay())
                  (toggleRef.current ?? openerRef.current)?.focus();
              }
            }}
          >
            <DialogTitle className="sr-only">{entityName} Notebook</DialogTitle>
            <DialogDescription className="sr-only">
              {props.kind === 'character'
                ? 'Game plans, practice reminders, and reference links.'
                : 'Game plan and practice reminders.'}
            </DialogDescription>
            {notebookBody}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
});
