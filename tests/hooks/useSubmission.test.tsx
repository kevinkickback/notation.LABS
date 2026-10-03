import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSubmission } from '@/hooks/useSubmission';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, failed) => { resolve = done; reject = failed; });
  return { promise, resolve, reject };
}

describe('editor submissions', () => {
  it('locks immediately before rendering and permits retry after failure', async () => {
    const saved = deferred<void>();
    const write = vi.fn(() => saved.promise);
    const callbacks = { onSuccess: vi.fn(), onError: vi.fn() };
    const { result } = renderHook(() => useSubmission(true));
    let first!: Promise<void>;
    act(() => { first = result.current.submit(write, callbacks); void result.current.submit(write, callbacks); });
    expect(write).toHaveBeenCalledOnce();
    expect(result.current.pending).toBe(true);
    const error = new Error('write failed');
    await act(async () => { saved.reject(error); await first; });
    expect(callbacks.onError).toHaveBeenCalledWith(error);
    expect(result.current.pending).toBe(false);
    await act(() => result.current.submit(async () => undefined, callbacks));
    expect(callbacks.onSuccess).toHaveBeenCalledOnce();
  });

  it.each(['close', 'entity', 'unmount'] as const)('lets the write finish after %s without applying its success to a new editor', async change => {
    const saved = deferred<string>();
    const callbacks = { onSuccess: vi.fn(), onError: vi.fn() };
    const { result, rerender, unmount } = renderHook(({ open, key }) => useSubmission(open, key), { initialProps: { open: true, key: 'first' } });
    let first!: Promise<void>;
    act(() => { first = result.current.submit(() => saved.promise, callbacks); });
    if (change === 'close') { rerender({ open: false, key: 'first' }); rerender({ open: true, key: 'first' }); }
    if (change === 'entity') rerender({ open: true, key: 'second' });
    if (change === 'unmount') unmount();
    const next = vi.fn(async () => 'next');
    if (change !== 'unmount') {
      expect(result.current.pending).toBe(true);
      await act(() => result.current.submit(next, callbacks));
      expect(next).not.toHaveBeenCalled();
    }
    await act(async () => { saved.resolve('written'); await first; });
    expect(callbacks.onSuccess).not.toHaveBeenCalled();
    if (change !== 'unmount') {
      expect(result.current.pending).toBe(false);
      await act(() => result.current.submit(next, callbacks));
      expect(callbacks.onSuccess).toHaveBeenCalledWith('next');
    }
  });

  it('still reports a persisted write failure after the editor unmounts', async () => {
    const saved = deferred<void>();
    const callbacks = { onSuccess: vi.fn(), onError: vi.fn() };
    const { result, unmount } = renderHook(() => useSubmission(true));
    let write!: Promise<void>;
    act(() => { write = result.current.submit(() => saved.promise, callbacks); });
    unmount();
    const error = new Error('disk unavailable');
    await act(async () => { saved.reject(error); await write; });
    expect(callbacks.onError).toHaveBeenCalledWith(error);
    expect(callbacks.onSuccess).not.toHaveBeenCalled();
  });

  it('does not start writes from a closed editor', async () => {
    const write = vi.fn(async () => undefined);
    const { result } = renderHook(() => useSubmission(false));
    await act(() => result.current.submit(write, { onSuccess: vi.fn(), onError: vi.fn() }));
    expect(write).not.toHaveBeenCalled();
  });
});
