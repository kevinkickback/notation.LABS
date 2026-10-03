import { useEffect, useRef } from 'react';
import {
  DEFAULT_DOCK_WIDTH,
  MIN_DOCK_WIDTH,
  useNotebookWorkspace,
} from './NotebookWorkspace';

export function NotebookDockResize({
  side,
  onResizingChange,
}: {
  side: 'left' | 'right';
  onResizingChange: (resizing: boolean) => void;
}) {
  const dock = useNotebookWorkspace();
  const resizeStart = useRef<{
    pointerId: number;
    x: number;
    width: number;
  } | null>(null);
  const cancelWidth = dock?.cancelWidth;
  useEffect(
    () => () => {
      resizeStart.current = null;
      onResizingChange(false);
      cancelWidth?.();
    },
    [cancelWidth, onResizingChange],
  );
  if (!dock) return null;
  return (
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
        onResizingChange(true);
      }}
      onPointerMove={(event) => {
        const start = resizeStart.current;
        if (start?.pointerId === event.pointerId)
          dock.setWidth(
            start.width +
              (side === 'left'
                ? event.clientX - start.x
                : start.x - event.clientX),
          );
      }}
      onPointerUp={(event) => {
        const start = resizeStart.current;
        if (start?.pointerId !== event.pointerId) return;
        resizeStart.current = null;
        // Persist the final choice once, rather than every drag frame.
        dock.saveWidth(
          start.width +
            (side === 'left'
              ? event.clientX - start.x
              : start.x - event.clientX),
        );
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        onResizingChange(false);
      }}
      onPointerCancel={() => {
        resizeStart.current = null;
        onResizingChange(false);
        dock.cancelWidth();
      }}
      onLostPointerCapture={() => {
        resizeStart.current = null;
        onResizingChange(false);
        dock.cancelWidth();
      }}
      onDoubleClick={() => dock.saveWidth(DEFAULT_DOCK_WIDTH)}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 50 : 20;
        if (event.key === 'ArrowLeft')
          dock.saveWidth(dock.width + (side === 'left' ? -step : step));
        else if (event.key === 'ArrowRight')
          dock.saveWidth(dock.width + (side === 'left' ? step : -step));
        else if (event.key === 'Home') dock.saveWidth(MIN_DOCK_WIDTH);
        else if (event.key === 'End') dock.saveWidth(dock.maxWidth);
        else return;
        event.preventDefault();
      }}
    />
  );
}
