import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useSettings, useSettingsActions } from '@/context/SettingsContext';
import { hasModalOverlay } from '@/lib/uiFocus';

type Point = { x: number; y: number };
type Size = { width: number; height: number };
export type NotebookLayout = 'floating' | 'left' | 'right';

const DEFAULT_FLOATING_SIZE: Size = { width: 480, height: 640 };

function floatingBounds(size: Size) {
  const width = Math.min(size.width, window.innerWidth - 32);
  const height = Math.min(size.height, window.innerHeight - 132);
  return {
    width,
    height,
    left: 16,
    right: Math.max(16, window.innerWidth - width - 16),
    top: 88,
    bottom: Math.max(88, window.innerHeight - height - 44),
  };
}

function clampPosition(point: Point, size: Size): Point {
  const bounds = floatingBounds(size);
  return {
    x: Math.max(bounds.left, Math.min(bounds.right, point.x)),
    y: Math.max(bounds.top, Math.min(bounds.bottom, point.y)),
  };
}

function relativePosition(point: Point, size: Size): Point {
  const bounds = floatingBounds(size);
  const clamped = clampPosition(point, size);
  return {
    x:
      bounds.right === bounds.left
        ? 1
        : (clamped.x - bounds.left) / (bounds.right - bounds.left),
    y:
      bounds.bottom === bounds.top
        ? 0
        : (clamped.y - bounds.top) / (bounds.bottom - bounds.top),
  };
}

function resizeFromCorner(size: Size, right: number, top: number): Size {
  return {
    width: Math.round(Math.max(320, Math.min(800, right - 16, size.width))),
    height: Math.round(
      Math.max(280, Math.min(1000, window.innerHeight - top - 44, size.height)),
    ),
  };
}

export function useNotebookPlacement({
  enabled,
  isOpen,
  workspace,
  dockWidth,
}: {
  enabled: boolean;
  isOpen: boolean;
  workspace: HTMLDivElement | null;
  dockWidth: number;
}) {
  const {
    notebookDocked = false,
    notebookDockSide = 'right',
    notebookFloatingPosition,
    notebookFloatingSize,
  } = useSettings();
  const { setSettings } = useSettingsActions();
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const [draft, setDraft] = useState<{
    kind: 'move' | 'resize';
    position: Point;
    size: Size;
  } | null>(null);
  const [snap, setSnap] = useState<'left' | 'right' | null>(null);
  const [, refreshViewport] = useState(0);
  const drag = useRef<{
    pointerId: number;
    kind: 'move' | 'resize';
    start: Point;
    offset: Point;
    position: Point;
    size: Size;
    initialSize: Size;
    right: number;
    top: number;
    started: boolean;
    snap: 'left' | 'right' | null;
    focus: HTMLElement | null;
  } | null>(null);
  const cleanupDrag = useRef<(() => void) | null>(null);
  const layout: NotebookLayout = notebookDocked ? notebookDockSide : 'floating';
  const isDocked = enabled && notebookDocked && draft === null;
  const size = draft?.size ?? notebookFloatingSize ?? DEFAULT_FLOATING_SIZE;
  const bounds = floatingBounds(size);
  const position = draft?.position ?? {
    x:
      bounds.left +
      (bounds.right - bounds.left) * (notebookFloatingPosition?.x ?? 1),
    y:
      bounds.top +
      (bounds.bottom - bounds.top) * (notebookFloatingPosition?.y ?? 0),
  };

  const finishDrag = useCallback(() => {
    cleanupDrag.current?.();
    cleanupDrag.current = null;
    const previous = drag.current;
    drag.current = null;
    setDraft(null);
    setSnap(null);
    if (previous?.started && previous.focus?.isConnected && !hasModalOverlay())
      previous.focus.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const resize = () => {
      finishDrag();
      refreshViewport((value) => value + 1);
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [finishDrag]);
  useEffect(() => {
    if (!enabled || !isOpen) finishDrag();
  }, [enabled, isOpen, finishDrag]);
  useEffect(
    () => () => {
      cleanupDrag.current?.();
    },
    [],
  );

  const setLayout = (next: NotebookLayout) =>
    setSettings({
      notebookDocked: next !== 'floating',
      ...(next !== 'floating' ? { notebookDockSide: next } : {}),
    });
  const moveBy = (x: number, y: number) =>
    setSettings({
      notebookDocked: false,
      notebookFloatingPosition: relativePosition(
        {
          x: position.x + x,
          y: position.y + y,
        },
        size,
      ),
    });

  const startGesture = (
    event: ReactPointerEvent<HTMLElement>,
    kind: 'move' | 'resize',
  ) => {
    if (
      !enabled ||
      !isOpen ||
      !workspace ||
      !panel ||
      event.button !== 0 ||
      drag.current ||
      (kind === 'resize' && isDocked)
    )
      return;
    const target = event.target as HTMLElement;
    if (
      kind === 'move' &&
      target.closest(
        'button, a, input, textarea, [role="tab"], [role="menuitem"]',
      ) &&
      !target.closest('[data-notebook-move-handle]')
    )
      return;
    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    const focus =
      document.activeElement instanceof HTMLElement &&
      panel.contains(document.activeElement)
        ? document.activeElement
        : null;
    const grip = panel.querySelector<HTMLElement>(
      '[data-notebook-move-handle]',
    );
    drag.current = {
      pointerId: event.pointerId,
      kind,
      start: { x: event.clientX, y: event.clientY },
      offset: {
        x: isDocked
          ? ((event.clientX - rect.left) / rect.width) * bounds.width
          : event.clientX - rect.left,
        y: event.clientY - rect.top,
      },
      position: kind === 'resize' ? { x: rect.left, y: rect.top } : position,
      size,
      initialSize: { width: rect.width, height: rect.height },
      right: rect.right,
      top: rect.top,
      started: false,
      snap: null,
      focus: focus ?? (kind === 'resize' ? event.currentTarget : grip),
    };
    workspace.setPointerCapture(event.pointerId);
    const move = (pointer: PointerEvent) => {
      const active = drag.current;
      if (!active || pointer.pointerId !== active.pointerId) return;
      if (
        !active.started &&
        Math.hypot(
          pointer.clientX - active.start.x,
          pointer.clientY - active.start.y,
        ) < 5
      )
        return;
      active.started = true;
      if (active.kind === 'resize') {
        active.size = resizeFromCorner(
          {
            width:
              active.initialSize.width - (pointer.clientX - active.start.x),
            height:
              active.initialSize.height + (pointer.clientY - active.start.y),
          },
          active.right,
          active.top,
        );
        active.position = {
          x: active.right - floatingBounds(active.size).width,
          y: active.top,
        };
      } else {
        const requested = {
          x: pointer.clientX - active.offset.x,
          y: pointer.clientY - active.offset.y,
        };
        active.position = clampPosition(requested, active.size);
        const horizontalMovement = pointer.clientX - active.start.x;
        // Arm from the moving panel edge, with a deliberate push toward that side.
        active.snap =
          pointer.clientY >= 88 && pointer.clientY <= window.innerHeight - 44
            ? requested.x <= 24 && horizontalMovement <= -8
              ? 'left'
              : requested.x + bounds.width >= window.innerWidth - 24 &&
                  horizontalMovement >= 8
                ? 'right'
                : null
            : null;
      }
      setDraft({
        kind: active.kind,
        position: active.position,
        size: active.size,
      });
      setSnap(active.snap);
    };
    const up = (pointer: PointerEvent) => {
      const active = drag.current;
      if (!active || pointer.pointerId !== active.pointerId) return;
      move(pointer);
      if (active.started)
        void setSettings({
          ...(active.kind === 'resize'
            ? { notebookFloatingSize: active.size }
            : {
                notebookDocked: active.snap !== null,
                ...(active.snap ? { notebookDockSide: active.snap } : {}),
              }),
          notebookFloatingPosition: relativePosition(
            active.position,
            active.size,
          ),
        });
      finishDrag();
    };
    const cancel = (pointer: PointerEvent) => {
      if (drag.current?.pointerId === pointer.pointerId) finishDrag();
    };
    const key = (keyboard: globalThis.KeyboardEvent) => {
      if (keyboard.key === 'Escape') {
        keyboard.preventDefault();
        keyboard.stopImmediatePropagation();
        finishDrag();
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    workspace.addEventListener('lostpointercapture', cancel);
    window.addEventListener('blur', finishDrag);
    window.addEventListener('keydown', key, true);
    cleanupDrag.current = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      workspace.removeEventListener('lostpointercapture', cancel);
      window.removeEventListener('blur', finishDrag);
      window.removeEventListener('keydown', key, true);
      if (workspace.hasPointerCapture(event.pointerId))
        workspace.releasePointerCapture(event.pointerId);
    };
  };

  const onResizeKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const step = event.shiftKey ? 50 : 20;
    const delta: Record<string, Size> = {
      ArrowLeft: { width: -step, height: 0 },
      ArrowRight: { width: step, height: 0 },
      ArrowUp: { width: 0, height: -step },
      ArrowDown: { width: 0, height: step },
    };
    if (!delta[event.key]) return;
    event.preventDefault();
    const right = position.x + bounds.width;
    const next = resizeFromCorner(
      {
        width: bounds.width + delta[event.key].width,
        height: bounds.height + delta[event.key].height,
      },
      right,
      position.y,
    );
    void setSettings({
      notebookFloatingSize: next,
      notebookFloatingPosition: relativePosition(
        {
          x: right - floatingBounds(next).width,
          y: position.y,
        },
        next,
      ),
    });
  };

  const onMoveKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const step = event.shiftKey ? 50 : 20;
    const delta: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    if (delta[event.key]) {
      event.preventDefault();
      void moveBy(delta[event.key].x, delta[event.key].y);
    }
  };

  let previewStyle: CSSProperties | undefined;
  if (snap && workspace) {
    const rect = workspace.getBoundingClientRect();
    const style = getComputedStyle(workspace);
    // During a drag the main column has returned to its normal width.
    const extension = Math.min(
      Math.max(0, (window.innerWidth - rect.width) / 2 - 16),
      628,
    );
    previewStyle = {
      left:
        snap === 'left'
          ? rect.left - extension
          : rect.right + extension - dockWidth,
      top: Math.max(
        rect.top,
        Number.parseFloat(style.getPropertyValue('--notebook-dock-top')) || 146,
      ),
      width: dockWidth,
      height: style.getPropertyValue('--notebook-dock-height'),
    };
  }

  return {
    setPanel,
    layout,
    isDocked,
    dragging: draft?.kind === 'move',
    resizing: draft?.kind === 'resize',
    size: { width: bounds.width, height: bounds.height },
    snap,
    previewStyle,
    floatingStyle: enabled
      ? ({
          '--notebook-float-x': draft
            ? relativePosition(draft.position, size).x
            : (notebookFloatingPosition?.x ?? 1),
          '--notebook-float-y': draft
            ? relativePosition(draft.position, size).y
            : (notebookFloatingPosition?.y ?? 0),
          '--notebook-float-width': `${size.width}px`,
          '--notebook-float-height': `${size.height}px`,
        } as CSSProperties)
      : undefined,
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) =>
      startGesture(event, 'move'),
    onResizePointerDown: (event: ReactPointerEvent<HTMLElement>) =>
      startGesture(event, 'resize'),
    onMoveKeyDown,
    onResizeKeyDown,
    setLayout,
    moveBy,
  };
}
