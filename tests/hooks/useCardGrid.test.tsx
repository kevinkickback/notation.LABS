import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCardGrid } from '@/hooks/useCardGrid';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('useCardGrid', () => {
  it('recalculates on container resize and disconnects on unmount', () => {
    let width = 997;
    let resize = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { resize = callback; }
      observe() {}
      disconnect = disconnect;
    });
    const element = document.createElement('div');
    element.style.columnGap = '16px';
    vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => ({ width } as DOMRect));
    const { result, rerender, unmount } = renderHook(({ target }) => useCardGrid(target, true), {
      initialProps: { target: 190 },
    });
    act(() => result.current.ref(element));
    expect(result.current.layout.width).toBe(237.25);
    const originalChoices = result.current.layout.sizes;
    width = 600;
    act(() => resize());
    expect(result.current.layout.width).toBe(292);
    expect(result.current.layout.sizes).not.toEqual(originalChoices);
    rerender({ target: 300 });
    expect(result.current.layout.columns).toBe(1);
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
