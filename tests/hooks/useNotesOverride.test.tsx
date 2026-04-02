import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
    removeNotesOverride,
    useNotesOverride,
} from '@/hooks/useNotesOverride';

const NOTES_OVERRIDES_KEY = 'notes_overrides';

function createStorageMock() {
    const store = new Map<string, string>();
    return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: (key: string) => {
            store.delete(key);
        },
        clear: () => {
            store.clear();
        },
    };
}

describe('useNotesOverride', () => {
    beforeEach(() => {
        Object.defineProperty(globalThis, 'localStorage', {
            value: createStorageMock(),
            configurable: true,
            writable: true,
        });
        localStorage.clear();
    });

    it('uses the default state when no override exists', async () => {
        const { result } = renderHook(() => useNotesOverride('combo-1', true));

        await waitFor(() => {
            expect(result.current[0]).toBe(true);
        });
    });

    it('applies a stored override relative to the default state', async () => {
        localStorage.setItem(NOTES_OVERRIDES_KEY, JSON.stringify(['combo-1']));

        const { result } = renderHook(() => useNotesOverride('combo-1', false));

        await waitFor(() => {
            expect(result.current[0]).toBe(true);
        });
    });

    it('persists and removes overrides when toggled', () => {
        const { result } = renderHook(() => useNotesOverride('combo-1', false));

        act(() => {
            result.current[1]();
        });

        expect(result.current[0]).toBe(true);
        expect(localStorage.getItem(NOTES_OVERRIDES_KEY)).toBe(
            JSON.stringify(['combo-1']),
        );

        act(() => {
            result.current[1]();
        });

        expect(result.current[0]).toBe(false);
        expect(localStorage.getItem(NOTES_OVERRIDES_KEY)).toBe(JSON.stringify([]));
    });

    it('falls back to the default state when localStorage is invalid JSON', async () => {
        localStorage.setItem(NOTES_OVERRIDES_KEY, '{broken json');

        const { result } = renderHook(() => useNotesOverride('combo-1', false));

        await waitFor(() => {
            expect(result.current[0]).toBe(false);
        });
    });
});

describe('removeNotesOverride', () => {
    beforeEach(() => {
        Object.defineProperty(globalThis, 'localStorage', {
            value: createStorageMock(),
            configurable: true,
            writable: true,
        });
        localStorage.clear();
    });

    it('removes only the requested override entry', () => {
        localStorage.setItem(
            NOTES_OVERRIDES_KEY,
            JSON.stringify(['combo-1', 'combo-2']),
        );

        removeNotesOverride('combo-1');

        expect(localStorage.getItem(NOTES_OVERRIDES_KEY)).toBe(
            JSON.stringify(['combo-2']),
        );
    });
});