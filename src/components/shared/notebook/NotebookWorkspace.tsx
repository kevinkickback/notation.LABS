import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useWorkspaceLayout } from '@/components/workbench/WorkspaceFrame';
import { useSettings, useSettingsActions } from '@/context/SettingsContext';

export const MIN_DOCK_WIDTH = 320;
export const DEFAULT_DOCK_WIDTH = 400;
const MAX_DOCK_WIDTH = 600;
const NotebookWorkspaceContext = createContext<{
  workspace: HTMLDivElement | null;
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
  const { main, footer } = useWorkspaceLayout();
  const { setSetting } = useSettingsActions();
  const [triggerTarget, setTriggerTarget] = useState<HTMLDivElement | null>(
    null,
  );
  const [workspace, setWorkspace] = useState<HTMLDivElement | null>(null);
  const [workspaceWidth, setWorkspaceWidth] = useState(0);
  const [mainWidth, setMainWidth] = useState(0);
  const [dockBottom, setDockBottom] = useState(64);
  const [dockTop, setDockTop] = useState(0);
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
    const container = main;
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
        setDockTop(top);
        const footerHeight = footer?.getBoundingClientRect().height ?? 0;
        setDockBottom(
          footerHeight + (Number.parseFloat(style.paddingBottom) || 0),
        );
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(workspace);
    if (container) observer.observe(container);
    if (footer) observer.observe(footer);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [workspace, main, footer]);
  return (
    <NotebookWorkspaceContext.Provider
      value={{
        workspace,
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
            '--notebook-dock-height':
              'max(0px, calc(100dvh - var(--notebook-dock-top, 146px) - var(--notebook-dock-bottom, 64px)))',
            '--notebook-dock-top': dockTop > 0 ? `${dockTop}px` : undefined,
            '--notebook-dock-bottom': `${dockBottom}px`,
          } as CSSProperties
        }
      >
        <div className="notebook-main">{children}</div>
      </div>
    </NotebookWorkspaceContext.Provider>
  );
}

export function NotebookTriggerSlot() {
  const workspace = useNotebookWorkspace();
  return workspace ? (
    <div className="notebook-trigger-slot" ref={workspace.setTriggerTarget} />
  ) : null;
}

export const useNotebookWorkspace = () => useContext(NotebookWorkspaceContext);
