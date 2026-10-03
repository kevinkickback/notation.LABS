import {
  BookOpenIcon,
  DotsSixVerticalIcon,
  XIcon,
} from '@phosphor-icons/react';
import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { DialogBody } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type NotebookEntity,
  useNotebookEditor,
} from '@/hooks/useNotebookEditor';
import { useNotebookPlacement } from '@/hooks/useNotebookPlacement';
import { hasModalOverlay } from '@/lib/uiFocus';
import { NotebookDockResize } from './notebook/NotebookDockResize';
import { NotebookLayoutMenu } from './notebook/NotebookLayoutMenu';
import { NotebookNotes } from './notebook/NotebookNotes';
import { NotebookResources } from './notebook/NotebookResources';
import {
  DEFAULT_DOCK_WIDTH,
  useNotebookWorkspace,
} from './notebook/NotebookWorkspace';

export {
  NotebookTriggerSlot,
  NotebookWorkspace,
} from './notebook/NotebookWorkspace';
export interface EntityNotebookRef {
  editNote: () => void;
}
type EntityNotebookProps = NotebookEntity & {
  entityName: string;
  isOpen: boolean;
  onToggle: () => void;
  hideTrigger?: boolean;
};

export const EntityNotebook = forwardRef<
  EntityNotebookRef,
  EntityNotebookProps
>(function EntityNotebook(props, ref) {
  const { entityName, isOpen, onToggle, hideTrigger = false } = props;
  const links = props.links ?? [];
  const workspace = useNotebookWorkspace();
  const [wideWindow, setWideWindow] = useState(
    () => window.matchMedia('(min-width: 1100px)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1100px)');
    const change = (event: MediaQueryListEvent) => setWideWindow(event.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const movable = wideWindow && Boolean(workspace?.workspace);
  const placement = useNotebookPlacement({
    enabled: movable,
    isOpen,
    workspace: workspace?.workspace ?? null,
    dockWidth: workspace?.width ?? DEFAULT_DOCK_WIDTH,
  });
  const { isDocked } = placement;
  const editor = useNotebookEditor(props);
  const [dockResizing, setDockResizing] = useState(false);
  const contentId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const moveId = useId();
  const resizeId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const openFocusRequested = useRef(false);
  const previousOpen = useRef(isOpen);
  useImperativeHandle(ref, () => ({ editNote: editor.note.openNoteEditor }));

  useEffect(() => {
    const closed = previousOpen.current && !isOpen;
    previousOpen.current = isOpen;
    if (
      closed &&
      document.activeElement === document.body &&
      !hasModalOverlay()
    )
      (toggleRef.current ?? editor.openerRef.current)?.focus();
    if (!isOpen || !openFocusRequested.current) return;
    openFocusRequested.current = false;
    if (hasModalOverlay()) return;
    const panel = document.getElementById(contentId);
    const control = panel?.querySelector<HTMLElement>(
      isDocked
        ? 'button[aria-label="Notebook layout"]'
        : '[role="tab"][data-state="active"]',
    );
    (control ?? editor.note.noteActionRef.current)?.focus();
  }, [
    isOpen,
    isDocked,
    contentId,
    editor.openerRef,
    editor.note.noteActionRef,
  ]);

  const closeNotebook = () => {
    openFocusRequested.current = false;
    onToggle();
    (toggleRef.current ?? editor.openerRef.current)?.focus();
  };
  const moveHandle = movable && (
    <button
      type="button"
      id={moveId}
      className="notebook-move-handle"
      data-notebook-move-handle
      aria-label="Move notebook"
      title="Drag to move, or use arrow keys"
      onKeyDown={placement.onMoveKeyDown}
      onClick={(event) => event.currentTarget.focus()}
    >
      <DotsSixVerticalIcon size={16} />
    </button>
  );
  const panelTools = (
    <div className="notebook-panel-tools">
      {movable && <NotebookLayoutMenu placement={placement} />}
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
  const toolbarProps = {
    'data-movable': movable,
    onPointerDown: placement.onPointerDown,
  };
  const notebookBody =
    props.kind === 'character' ? (
      <Tabs
        value={editor.activeTab}
        onValueChange={editor.setActiveTab}
        className="notebook-panel-content"
      >
        <div className="notebook-panel-toolbar" {...toolbarProps}>
          {moveHandle}
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
          <TabsContent value="notes">
            <NotebookNotes editor={editor.note} notes={props.notes} />
          </TabsContent>
          <TabsContent value="resources">
            <NotebookResources editor={editor.resources} links={links} />
          </TabsContent>
        </DialogBody>
      </Tabs>
    ) : (
      <div className="notebook-panel-content">
        <div className="notebook-panel-toolbar" {...toolbarProps}>
          {moveHandle}
          <h2 className="notebook-panel-label">
            <BookOpenIcon size={16} />
            Notes
          </h2>
          {panelTools}
        </div>
        <DialogBody>
          <NotebookNotes editor={editor.note} notes={props.notes} />
        </DialogBody>
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
            openFocusRequested.current = true;
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
  // One panel in one portal: layout changes only affect its geometry and semantics.
  const panel = isOpen && (
    <aside
      ref={placement.setPanel}
      id={contentId}
      tabIndex={-1}
      role={isDocked ? 'complementary' : 'dialog'}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={isDocked ? 'notebook-docked' : 'notebook-drawer'}
      style={isDocked ? undefined : placement.floatingStyle}
      data-side={isDocked ? placement.layout : undefined}
      data-moving={placement.dragging}
      data-resizing={isDocked ? dockResizing : placement.resizing}
      data-desktop={movable}
      onKeyDown={(event) => {
        if (
          event.key !== 'Escape' ||
          event.defaultPrevented ||
          isDocked ||
          hasModalOverlay() ||
          !event.currentTarget.contains(event.target as Node)
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        closeNotebook();
      }}
    >
      <h2 className="sr-only" id={titleId}>
        {entityName} Notebook
      </h2>
      <p className="sr-only" id={descriptionId}>
        {props.kind === 'character'
          ? 'Game plans, practice reminders, and reference links.'
          : 'Game plan and practice reminders.'}
      </p>
      {notebookBody}
      {isDocked && (
        <NotebookDockResize
          key={placement.layout}
          side={placement.layout === 'left' ? 'left' : 'right'}
          onResizingChange={setDockResizing}
        />
      )}
      {!isDocked && movable && (
        <button
          type="button"
          id={resizeId}
          className="notebook-floating-resize-handle"
          aria-label="Resize notebook"
          aria-description={`${Math.round(placement.size.width)} by ${Math.round(placement.size.height)} pixels`}
          title="Drag to resize, or use arrow keys"
          onPointerDown={placement.onResizePointerDown}
          onKeyDown={placement.onResizeKeyDown}
        />
      )}
    </aside>
  );
  return (
    <div
      className="entity-notebook"
      data-hide-trigger={hideTrigger}
      data-toolbar-trigger={Boolean(workspace?.triggerTarget)}
    >
      {workspace?.triggerTarget
        ? createPortal(trigger, workspace.triggerTarget)
        : trigger}
      {workspace
        ? workspace.workspace && createPortal(panel, workspace.workspace)
        : panel}
      {placement.snap &&
        workspace?.workspace &&
        createPortal(
          <div
            className="notebook-snap-preview"
            style={placement.previewStyle}
            aria-hidden="true"
          >
            Dock {placement.snap}
          </div>,
          workspace.workspace,
        )}
    </div>
  );
});
