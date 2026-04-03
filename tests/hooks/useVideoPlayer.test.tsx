import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
