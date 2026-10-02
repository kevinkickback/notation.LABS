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

  it('keeps a pending toggle through cloned and unrelated settings refreshes until acknowledged', async () => {
    let finishWrite: () => void = () => {};
    setNotesOverrideMock.mockImplementationOnce(() => new Promise<void>(resolve => { finishWrite = resolve; }));
    const { result, rerender } = renderHook(() => useNotesOverride('char-1', false));
    act(() => result.current[1]());
    currentOverrides = [...currentOverrides];
    rerender();
    expect(result.current[0]).toBe(true);
    currentOverrides = ['other-char'];
    rerender();
    expect(result.current[0]).toBe(true);
    await act(async () => finishWrite());
    expect(result.current[0]).toBe(true);
    currentOverrides = ['other-char', 'char-1'];
    rerender();
    expect(result.current[0]).toBe(true);
    currentOverrides = ['other-char'];
    rerender();
    expect(result.current[0]).toBe(false);
  });

  it('keeps the latest of opposite toggles while earlier saves refresh the snapshot', async () => {
    let finishFirst: () => void = () => {};
    let finishSecond: () => void = () => {};
    setNotesOverrideMock
      .mockImplementationOnce(() => new Promise<void>(resolve => { finishFirst = resolve; }))
      .mockImplementationOnce(() => new Promise<void>(resolve => { finishSecond = resolve; }));
    const { result, rerender } = renderHook(() => useNotesOverride('char-1', false));
    act(() => result.current[1]());
    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
    currentOverrides = ['char-1'];
    rerender();
    await act(async () => finishFirst());
    expect(result.current[0]).toBe(false);
    await act(async () => finishSecond());
    expect(result.current[0]).toBe(false);
    currentOverrides = [];
    rerender();
    expect(result.current[0]).toBe(false);
  });

  it('discards a pending choice on a new global default and ignores its late completion', async () => {
    let finishWrite: () => void = () => {};
    setNotesOverrideMock.mockImplementationOnce(() => new Promise<void>(resolve => { finishWrite = resolve; }));
    const { result, rerender } = renderHook(
      ({ defaultOpen }) => useNotesOverride('char-1', defaultOpen),
      { initialProps: { defaultOpen: true } },
    );
    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
    rerender({ defaultOpen: false });
    expect(result.current[0]).toBe(false);
    await act(async () => finishWrite());
    currentOverrides = ['char-1'];
    rerender({ defaultOpen: false });
    expect(result.current[0]).toBe(true);
  });
});
