import { useLayoutEffect, useMemo, useState } from 'react';
import { getCardGridLayout } from '@/lib/cardGrid';

export function useCardGrid(targetSize: number, isGrid: boolean, scale = 1) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [bounds, setBounds] = useState({ width: 0, gap: 0 });

  useLayoutEffect(() => {
    if (!element || !isGrid) return;
    const measure = () => {
      const width = element.getBoundingClientRect().width;
      const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0;
      setBounds((previous) =>
        previous.width === width && previous.gap === gap
          ? previous
          : { width, gap },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, isGrid]);

  const layout = useMemo(
    () => getCardGridLayout(bounds.width, bounds.gap, targetSize, scale),
    [bounds, targetSize, scale],
  );
  return { ref: setElement, layout };
}
