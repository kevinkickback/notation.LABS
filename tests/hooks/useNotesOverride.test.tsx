import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { setNotesOverrideMock } = vi.hoisted(() => ({
  setNotesOverrideMock:
    vi.fn<(entityId: string, isOverride: boolean) => Promise<void>>(),
}));

vi.mock('@/context/SettingsContext', () => ({
  useSettings: () => ({ notesOverrides: currentOverrides }),
  useSettingsActions: () => ({ setNotesPanelOpen: setNotesOverrideMock }),
}));

import { useNotesOverride } from '@/hooks/useNotesOverride';

let currentOverrides: string[] = [];

describe('useNotesOverride', () => {
  beforeEach(() => {
    currentOverrides = [];
    setNotesOverrideMock.mockReset();
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

  it('applies entity, default, and saved override changes on the first render', () => {
    currentOverrides = ['char-1'];
    const { result, rerender } = renderHook(
      ({ id, defaultOpen }) => useNotesOverride(id, defaultOpen),
      { initialProps: { id: 'char-1', defaultOpen: false } },
    );
    expect(result.current[0]).toBe(true);
    rerender({ id: 'char-2', defaultOpen: false });
    expect(result.current[0]).toBe(false);
    currentOverrides = [];
    rerender({ id: 'char-1', defaultOpen: true });
    expect(result.current[0]).toBe(true);
    currentOverrides = ['char-1'];
    rerender({ id: 'char-1', defaultOpen: true });
    expect(result.current[0]).toBe(false);
  });

  it('does not roll back a new entity when an earlier toggle fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let rejectWrite: (error: Error) => void = () => {};
    setNotesOverrideMock.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectWrite = reject; }));
    const { result, rerender } = renderHook(
      ({ id }) => useNotesOverride(id, false),
      { initialProps: { id: 'char-1' } },
    );
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    rerender({ id: 'char-2' });
    await act(async () => rejectWrite(new Error('write failed')));
    expect(result.current[0]).toBe(false);
  });
});
