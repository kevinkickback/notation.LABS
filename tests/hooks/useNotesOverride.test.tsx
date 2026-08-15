import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getNotesOverridesMock,
  setNotesOverrideMock,
  removeNotesOverrideMock,
} = vi.hoisted(() => ({
  getNotesOverridesMock: vi.fn<() => Promise<string[]>>(),
  setNotesOverrideMock:
    vi.fn<(entityId: string, isOverride: boolean) => Promise<void>>(),
  removeNotesOverrideMock: vi.fn<(entityId: string) => Promise<void>>(),
}));

vi.mock('@/lib/application/settingsCommands', () => ({
  getNotesOverrides: getNotesOverridesMock,
  setNotesOverride: setNotesOverrideMock,
  removeNotesOverride: removeNotesOverrideMock,
}));

import {
  removeNotesOverride,
  useNotesOverride,
} from '@/hooks/useNotesOverride';

let currentOverrides: string[] = [];

describe('useNotesOverride', () => {
  beforeEach(() => {
    currentOverrides = [];
    getNotesOverridesMock.mockReset();
    setNotesOverrideMock.mockReset();
    removeNotesOverrideMock.mockReset();

    getNotesOverridesMock.mockImplementation(async () => [...currentOverrides]);
    setNotesOverrideMock.mockImplementation(
      async (entityId: string, isOverride: boolean) => {
        currentOverrides = isOverride
          ? [...new Set([...currentOverrides, entityId])]
          : currentOverrides.filter((id) => id !== entityId);
      },
    );
    removeNotesOverrideMock.mockImplementation(async (entityId: string) => {
      currentOverrides = currentOverrides.filter((id) => id !== entityId);
    });
  });

  it('uses the default state when no override exists', async () => {
    const { result } = renderHook(() => useNotesOverride('combo-1', true));

    await waitFor(() => {
      expect(result.current[0]).toBe(true);
    });
  });

  it('applies a stored override relative to the default state', async () => {
    currentOverrides = ['combo-1'];

    const { result } = renderHook(() => useNotesOverride('combo-1', false));

    await waitFor(() => {
      expect(result.current[0]).toBe(true);
    });
  });

  it('persists and removes overrides when toggled', async () => {
    const { result } = renderHook(() => useNotesOverride('combo-1', false));

    await waitFor(() => {
      expect(result.current[0]).toBe(false);
    });

    act(() => {
      result.current[1]();
    });

    expect(result.current[0]).toBe(true);
    await waitFor(() => {
      expect(setNotesOverrideMock).toHaveBeenCalledWith('combo-1', true);
    });

    act(() => {
      result.current[1]();
    });

    expect(result.current[0]).toBe(false);
    await waitFor(() => {
      expect(setNotesOverrideMock).toHaveBeenCalledWith('combo-1', false);
    });
  });

  it('falls back to the default state when overrides cannot be loaded', async () => {
    getNotesOverridesMock.mockRejectedValueOnce(new Error('load failed'));

    const { result } = renderHook(() => useNotesOverride('combo-1', false));

    await waitFor(() => {
      expect(result.current[0]).toBe(false);
    });
  });
});

describe('removeNotesOverride', () => {
  beforeEach(() => {
    currentOverrides = ['combo-1', 'combo-2'];
    removeNotesOverrideMock.mockReset();
    removeNotesOverrideMock.mockImplementation(async (entityId: string) => {
      currentOverrides = currentOverrides.filter((id) => id !== entityId);
    });
  });

  it('delegates removal to IndexedDB settings storage', async () => {
    await removeNotesOverride('combo-1');

    expect(removeNotesOverrideMock).toHaveBeenCalledWith('combo-1');
  });
});
