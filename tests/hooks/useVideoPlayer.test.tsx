import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Combo } from '@/lib/types';

import { useVideoPlayer } from '@/hooks/useVideoPlayer';

const { getBlobUrlMock, reportErrorMock, toastErrorMock } = vi.hoisted(() => ({
  getBlobUrlMock: vi.fn(),
  reportErrorMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
  },
}));

vi.mock('@/lib/errors', () => ({
  reportError: reportErrorMock,
  toUserMessage: (err: unknown) =>
    err instanceof Error ? err.message : 'An unexpected error occurred',
}));

vi.mock('@/lib/storage/indexedDbStorage', () => ({
  getLocalVideoId: (demoUrl?: string) => {
    if (!demoUrl?.startsWith('local:')) {
      return null;
    }

    return demoUrl.slice('local:'.length) || null;
  },
  indexedDbStorage: {
    demoVideos: {
      getBlobUrl: getBlobUrlMock,
    },
  },
}));

describe('useVideoPlayer', () => {
  afterEach(() => vi.unstubAllGlobals());
  const combo: Combo = { id: 'local', characterId: 'char', name: 'Demo', notation: '5L', parsedNotation: [], tags: [], sortOrder: 0, createdAt: 1, updatedAt: 1, demoUrl: 'local:video' };

  it.each(['close', 'replace', 'unmount', 'navigate'] as const)('releases delayed local video URLs after %s', async action => {
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(class extends URL {}, { revokeObjectURL: revoke }));
    let resolve!: (url: string) => void;
    getBlobUrlMock.mockReturnValue(new Promise<string>(done => { resolve = done; }));
    const { result, unmount, rerender } = renderHook(({ key }) => useVideoPlayer('lg', key), { initialProps: { key: 'first' } });
    let load!: Promise<void>;
    act(() => { load = result.current.handleWatchDemo(combo); });
    if (action === 'close') act(() => result.current.closeVideoPlayer());
    if (action === 'replace') await act(async () => { await result.current.handleWatchDemo({ ...combo, id: 'remote', demoUrl: 'https://example.com/demo' }); });
    if (action === 'unmount') unmount();
    if (action === 'navigate') rerender({ key: 'second' });
    await act(async () => { resolve('blob:outdated'); await load; });
    expect(revoke.mock.calls).toEqual([['blob:outdated']]);
    if (action !== 'unmount') expect(result.current.videoPlayerUrl).toBe(action === 'replace' ? 'https://example.com/demo' : null);
  });

  it('releases active video URLs exactly once on replacement and close', async () => {
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(class extends URL {}, { revokeObjectURL: revoke }));
    getBlobUrlMock.mockResolvedValueOnce('blob:first').mockResolvedValueOnce('blob:second');
    const { result, unmount } = renderHook(() => useVideoPlayer('lg'));
    await act(async () => { await result.current.handleWatchDemo(combo); });
    await act(async () => { await result.current.handleWatchDemo({ ...combo, id: 'second' }); });
    act(() => result.current.closeVideoPlayer());
    unmount();
    expect(revoke.mock.calls).toEqual([['blob:first'], ['blob:second']]);
  });
  beforeEach(() => {
    getBlobUrlMock.mockReset();
    reportErrorMock.mockReset();
    toastErrorMock.mockReset();
  });

  it('opens the player for remote demo URLs', async () => {
    const { result } = renderHook(() => useVideoPlayer('lg'));

    await act(async () => {
      await result.current.handleWatchDemo({
        id: 'combo-1',
        characterId: 'char-1',
        name: 'Remote Demo',
        notation: '236P',
        parsedNotation: [],
        tags: [],
        sortOrder: 0,
        createdAt: 1,
        updatedAt: 1,
        demoUrl: 'https://example.com/demo',
      });
    });

    expect(result.current.videoPlayerOpen).toBe(true);
    expect(result.current.videoPlayerUrl).toBe('https://example.com/demo');
    expect(result.current.videoPlayerTitle).toBe('Remote Demo');
  });

  it('shows an error when a local video file is missing', async () => {
    getBlobUrlMock.mockResolvedValue(null);

    const { result } = renderHook(() => useVideoPlayer('lg'));

    await act(async () => {
      await result.current.handleWatchDemo({
        id: 'combo-1',
        characterId: 'char-1',
        name: 'Local Demo',
        notation: '236P',
        parsedNotation: [],
        tags: [],
        sortOrder: 0,
        createdAt: 1,
        updatedAt: 1,
        demoUrl: 'local:video-1',
      });
    });

    expect(result.current.videoPlayerOpen).toBe(false);
    expect(toastErrorMock).toHaveBeenCalledWith('Video file not found');
  });

  it('reports errors when blob loading throws', async () => {
    getBlobUrlMock.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useVideoPlayer('lg'));

    await act(async () => {
      await result.current.handleWatchDemo({
        id: 'combo-1',
        characterId: 'char-1',
        name: 'Broken Demo',
        notation: '236P',
        parsedNotation: [],
        tags: [],
        sortOrder: 0,
        createdAt: 1,
        updatedAt: 1,
        demoUrl: 'local:video-1',
      });
    });

    expect(reportErrorMock).toHaveBeenCalledWith(
      'useVideoPlayer.handleWatchDemo',
      expect.any(Error),
    );
    expect(toastErrorMock).toHaveBeenCalledWith('boom');
  });
});
