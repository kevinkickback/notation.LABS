import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppLoadingOverlay } from '@/components/workbench/AppLoadingOverlay';

afterEach(() => vi.useRealTimers());

describe('AppLoadingOverlay', () => {
  it('reports actual loading stages and exits only after readiness', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const props = { error: null, onRetry: vi.fn(), onComplete };
    const { rerender } = render(<AppLoadingOverlay {...props} stage="settings" />);
    expect(screen.getByRole('status').textContent).toContain('Restoring your preferences');
    act(() => vi.advanceTimersByTime(5000));
    expect(onComplete).not.toHaveBeenCalled();
    rerender(<AppLoadingOverlay {...props} stage="parsing" />);
    expect(screen.getByRole('status').textContent).toContain('Updating stored combo notation');
    rerender(<AppLoadingOverlay {...props} stage="library" />);
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('75');
    rerender(<AppLoadingOverlay {...props} stage="ready" />);
    act(() => vi.advanceTimersByTime(650));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('keeps a failed startup visible and offers a retry', () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    const onComplete = vi.fn();
    render(<AppLoadingOverlay stage="settings" error="Storage is unavailable" onRetry={onRetry} onComplete={onComplete} />);
    expect(screen.getByText('Storage is unavailable')).toBeTruthy();
    act(() => vi.advanceTimersByTime(5000));
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
