import { type CSSProperties, useLayoutEffect, useState } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useWorkspaceLayout } from '@/components/workbench/WorkspaceFrame';
import { useSettings } from '@/context/SettingsContext';

export const HISTORY_TOAST_HEIGHT = 120;

const Toaster = ({
  anchor,
  ...props
}: ToasterProps & { anchor?: HTMLElement | null }) => {
  const { colorTheme } = useSettings();
  const { footer } = useWorkspaceLayout();
  const [bottom, setBottom] = useState(48);
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      const top =
        (anchor ?? footer)?.getBoundingClientRect().top ??
        window.innerHeight - 40;
      setBottom(Math.max(8, window.innerHeight - top + 8));
    };
    // Read after Radix has repositioned the panel, including a move without a size change.
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    if (footer) observer.observe(footer);
    if (anchor) observer.observe(anchor);
    measure();
    window.addEventListener('resize', schedule);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
    };
  }, [anchor, footer]);
  const offset = { bottom, right: 16, left: 16, top: 16 };

  return (
    <Sonner
      theme={colorTheme}
      position="bottom-right"
      offset={offset}
      mobileOffset={offset}
      visibleToasts={anchor ? 1 : 3}
      richColors
      toastOptions={{
        classNames: { content: 'toast-message' },
        style: {
          // Reserve Sonner's padding and border; its outer swipe areas must not scroll.
          '--toast-message-max-height': anchor
            ? `${HISTORY_TOAST_HEIGHT - 34}px`
            : `max(14px, calc(100dvh - ${bottom + 50}px))`,
          touchAction: 'pan-y',
        } as CSSProperties,
      }}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--success-text': 'var(--success)',
          '--warning-text': 'var(--warning)',
          '--error-text': 'var(--error)',
          '--info-text': 'var(--accent-text)',
        } as CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
