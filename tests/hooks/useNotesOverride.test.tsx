import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getNotesOverridesMock, setNotesOverrideMock } = vi.hoisted(() => ({
  getNotesOverridesMock: vi.fn<() => Promise<string[]>>(),
  setNotesOverrideMock:
    vi.fn<(entityId: string, isOverride: boolean) => Promise<void>>(),
}));

vi.mock('@/context/SettingsContext', () => ({
  useSettingsActions: () => ({ setNotesOverride: setNotesOverrideMock }),
}));

vi.mock('@/lib/storage/indexedDbStorage', () => ({
  indexedDbStorage: {
    settings: {
      getNotesOverrides: getNotesOverridesMock,
    },
  },
}));

import { useNotesOverride } from '@/hooks/useNotesOverride';

let currentOverrides: string[] = [];

describe('useNotesOverride', () => {
  beforeEach(() => {
    currentOverrides = [];
    getNotesOverridesMock.mockReset();
    setNotesOverrideMock.mockReset();

    getNotesOverridesMock.mockImplementation(async () => [...currentOverrides]);
    setNotesOverrideMock.mockImplementation(
      async (entityId: string, isOverride: boolean) => {
        currentOverrides = isOverride
          ? [...new Set([...currentOverrides, entityId])]
          : currentOverrides.filter((id) => id !== entityId);
      },
    );
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

  it('rolls back the toggle when persistence fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    setNotesOverrideMock.mockRejectedValueOnce(new Error('write failed'));
    const { result } = renderHook(() => useNotesOverride('combo-1', false));

    await waitFor(() => {
      expect(result.current[0]).toBe(false);
    });

    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(true);

    await waitFor(() => {
      expect(result.current[0]).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useNotesOverride.handleToggle]',
        expect.any(Error),
      );
    });
  });

  it('falls back to the default state when overrides cannot be loaded', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    getNotesOverridesMock.mockRejectedValueOnce(new Error('load failed'));

    const { result } = renderHook(() => useNotesOverride('combo-1', false));

    await waitFor(() => {
      expect(result.current[0]).toBe(false);
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[useNotesOverride.loadOverrides]',
      expect.any(Error),
    );
  });
});
