import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMediaRequest } from '@/hooks/useMediaRequest';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { resolve, promise };
}

describe('media sessions', () => {
  it('keeps only the latest load and disposes superseded results', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const applied = vi.fn();
    const discard = vi.fn();
    let signal!: AbortSignal;
    const { result } = renderHook(() => useMediaRequest(true));
    let firstRun!: Promise<void>;
    let secondRun!: Promise<void>;
    act(() => {
      firstRun = result.current.run('first', next => { signal = next; return first.promise; }, { onSuccess: applied, onDiscard: discard });
      secondRun = result.current.run('second', () => second.promise, { onSuccess: applied, onDiscard: discard });
    });
    expect(signal.aborted).toBe(true);
    await act(async () => { first.resolve('old'); await firstRun; });
    expect(result.current.pending).toBe('second');
    expect(discard).toHaveBeenCalledWith('old');
    await act(async () => { second.resolve('new'); await secondRun; });
    expect(applied.mock.calls).toEqual([['new']]);
    expect(result.current.pending).toBeNull();
  });

  it.each(['close', 'entity', 'unmount', 'cancel'] as const)('ignores a delayed response after %s', async action => {
    const request = deferred<string>();
    const applied = vi.fn();
    const error = vi.fn();
    let signal!: AbortSignal;
    const { result, rerender, unmount } = renderHook(({ open, key }) => useMediaRequest(open, key), { initialProps: { open: true, key: 'first' } });
    let run!: Promise<void>;
    act(() => { run = result.current.run('load', next => { signal = next; return request.promise; }, { onSuccess: applied, onError: error }); });
    if (action === 'close') { rerender({ open: false, key: 'first' }); rerender({ open: true, key: 'first' }); }
    if (action === 'entity') rerender({ open: true, key: 'second' });
    if (action === 'unmount') unmount();
    if (action === 'cancel') act(() => result.current.cancel());
    expect(signal.aborted).toBe(true);
    await act(async () => { request.resolve('outdated'); await run; });
    expect(applied).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
