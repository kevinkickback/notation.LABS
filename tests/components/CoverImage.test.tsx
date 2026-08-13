import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoverImage } from '@/components/shared/CoverImage';
import { CoverImageControls } from '@/components/shared/CoverImageControls';

class MockImage {
  naturalWidth = 1600;
  naturalHeight = 900;
  onload: (() => void) | null = null;

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

class MockPointerEvent extends MouseEvent {
  pointerId: number;

  constructor(type: string, properties: PointerEventInit = {}) {
    super(type, properties);
    this.pointerId = properties.pointerId ?? 0;
  }
}

describe('CoverImage', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', MockImage);
    vi.stubGlobal('PointerEvent', MockPointerEvent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the loaded image dimensions for fill and free crop modes', async () => {
    const { container, rerender } = render(
      <CoverImage
        src="data:image/png;base64,cover"
        frameAspect={3 / 4}
        fit="fill"
        focalX={25}
        focalY={75}
      />,
    );
    const cover = container.firstElementChild as HTMLDivElement;

    await waitFor(() => {
      expect(Number.parseFloat(cover.style.backgroundSize)).toBeCloseTo(
        237.04,
      );
    });
    expect(cover.style.backgroundPosition).toBe('25% 75%');

    rerender(
      <CoverImage
        src="data:image/png;base64,cover"
        frameAspect={3 / 4}
        fit="free"
        focalX={25}
        focalY={75}
      />,
    );

    expect(Number.parseFloat(cover.style.backgroundSize)).toBe(100);
  });

  it('supports pointer dragging when the preview is interactive', async () => {
    const onFocalPointChange = vi.fn();
    const { container } = render(
      <CoverImage
        src="data:image/png;base64,cover"
        frameAspect={1}
        interactive
        onFocalPointChange={onFocalPointChange}
      />,
    );
    const cover = container.firstElementChild as HTMLDivElement;

    await waitFor(() => {
      expect(Number.parseFloat(cover.style.backgroundSize)).toBeCloseTo(
        177.78,
      );
    });

    Object.defineProperties(cover, {
      clientWidth: { configurable: true, value: 200 },
      clientHeight: { configurable: true, value: 200 },
      setPointerCapture: { configurable: true, value: vi.fn() },
      hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    });

    fireEvent.pointerDown(cover, {
      pointerId: 7,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(cover, {
      pointerId: 7,
      clientX: 0,
      clientY: 100,
    });

    expect(onFocalPointChange).toHaveBeenCalledWith(100, 50);

    fireEvent.pointerUp(cover, { pointerId: 7 });
    expect(cover.releasePointerCapture).toHaveBeenCalledWith(7);
  });
});

describe('CoverImageControls', () => {
  it('exposes current adjustments and invokes the primary actions', async () => {
    const user = userEvent.setup();
    const onFitChange = vi.fn();
    const onZoomChange = vi.fn();
    const onReset = vi.fn();

    render(
      <CoverImageControls
        fit="free"
        zoom={135}
        focalX={25}
        focalY={75}
        onFitChange={onFitChange}
        onZoomChange={onZoomChange}
        onFocalXChange={vi.fn()}
        onFocalYChange={vi.fn()}
        onReset={onReset}
      />,
    );

    expect(
      screen.getByRole('switch', { name: 'Fill frame' }).getAttribute(
        'aria-checked',
      ),
    ).toBe('false');
    expect(
      screen.getByRole('slider', { name: 'Zoom' }).getAttribute('aria-valuenow'),
    ).toBe('135');
    expect(
      screen.getByRole('slider', { name: 'Pan X' }).getAttribute('aria-valuenow'),
    ).toBe('25');
    expect(
      screen.getByRole('slider', { name: 'Pan Y' }).getAttribute('aria-valuenow'),
    ).toBe('75');

    await user.click(screen.getByRole('switch', { name: 'Fill frame' }));
    expect(onFitChange).toHaveBeenCalledWith('fill');

    const resetButton = screen.getByRole('button', { name: 'Reset' });
    expect(resetButton.className).toContain('bg-accent');
    expect(resetButton.className).toContain('hover:bg-destructive');
    await user.click(resetButton);
    expect(onReset).toHaveBeenCalledOnce();
  });
});
