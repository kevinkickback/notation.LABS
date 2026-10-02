import 'fake-indexeddb/auto';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecoverableLiveQuery } from '@/hooks/useRecoverableLiveQuery';
import { db, indexedDbStorage } from '@/lib/storage/indexedDbStorage';

beforeEach(async () => { await db.games.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('recoverable Dexie reads', () => {
  it('captures a rejected read, retries it, and continues observing database changes', async () => {
    const query = vi.spyOn(indexedDbStorage.games, 'getAll').mockRejectedValueOnce(new Error('Library temporarily locked'));
    const { result, rerender } = renderHook(({ attempt }) => useRecoverableLiveQuery(indexedDbStorage.games.getAll, [], attempt), { initialProps: { attempt: 0 } });
    await waitFor(() => expect(result.current.error).toBe('Library temporarily locked'));
    expect(result.current.data).toBeUndefined();
    rerender({ attempt: 1 });
    expect(result.current).toEqual({ data: undefined, error: null });
    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(query).toHaveBeenCalledTimes(2);
    await act(async () => { await indexedDbStorage.games.add({ name: 'Recovered game', buttonLayout: ['A'] }); });
    await waitFor(() => expect(result.current.data?.[0]?.name).toBe('Recovered game'));
    expect(result.current.error).toBeNull();
  });
  it('does not reuse a cached successful read to complete a new retry', async () => {
    const query = vi.fn<() => Promise<string[]>>().mockResolvedValueOnce(['old']);
    let finishRead!: (rows: string[]) => void;
    query.mockImplementationOnce(() => new Promise(resolve => { finishRead = resolve; }));
    const { result, rerender } = renderHook(({ attempt }) => useRecoverableLiveQuery(query, [], attempt), { initialProps: { attempt: 0 } });
    await waitFor(() => expect(result.current.data).toEqual(['old']));
    rerender({ attempt: 1 });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2));
    await act(async () => { finishRead(['new']); });
    await waitFor(() => expect(result.current.data).toEqual(['new']));
  });
});
