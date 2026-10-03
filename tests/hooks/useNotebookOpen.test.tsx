import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { setNotebookOpenMock } = vi.hoisted(() => ({
  setNotebookOpenMock:
    vi.fn<(entityId: string, isOpen: boolean) => Promise<void>>(),
}));

vi.mock('@/context/SettingsContext', () => ({
  useSettings: () => ({ notebookOpenPages: currentPages }),
  useSettingsActions: () => ({ setNotesPanelOpen: setNotebookOpenMock }),
}));

import { useNotebookOpen } from '@/hooks/useNotebookOpen';

let currentPages: string[] = [];

describe('useNotebookOpen', () => {
  beforeEach(() => {
    currentPages = [];
    setNotebookOpenMock.mockReset();
    setNotebookOpenMock.mockImplementation(
      async (entityId: string, isOpen: boolean) => {
        currentPages = isOpen
          ? [...new Set([...currentPages, entityId])]
          : currentPages.filter((id) => id !== entityId);
      },
    );
  });

  it('starts new pages closed', async () => {
    const { result } = renderHook(() => useNotebookOpen('combo-1'));

    await waitFor(() => {
      expect(result.current[0]).toBe(false);
    });
  });

  it('restores a remembered open page', async () => {
    currentPages = ['combo-1'];

    const { result } = renderHook(() => useNotebookOpen('combo-1'));

    await waitFor(() => {
      expect(result.current[0]).toBe(true);
    });
  });

  it('persists opening and closing a page when toggled', async () => {
    const { result } = renderHook(() => useNotebookOpen('combo-1'));

    await waitFor(() => {
      expect(result.current[0]).toBe(false);
    });

    act(() => {
      result.current[1]();
    });

    expect(result.current[0]).toBe(true);
    await waitFor(() => {
      expect(setNotebookOpenMock).toHaveBeenCalledWith('combo-1', true);
    });

    act(() => {
      result.current[1]();
    });

    expect(result.current[0]).toBe(false);
    await waitFor(() => {
      expect(setNotebookOpenMock).toHaveBeenCalledWith('combo-1', false);
    });
  });

  it('rolls back the toggle when persistence fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    setNotebookOpenMock.mockRejectedValueOnce(new Error('write failed'));
    const { result } = renderHook(() => useNotebookOpen('combo-1'));

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
        '[useNotebookOpen.handleToggle]',
        expect.any(Error),
      );
    });
  });

  it('applies entity and saved page choices on the first render', () => {
    currentPages = ['char-1'];
    const { result, rerender } = renderHook(
      ({ id }) => useNotebookOpen(id),
      { initialProps: { id: 'char-1' } },
    );
    expect(result.current[0]).toBe(true);
    rerender({ id: 'char-2' });
    expect(result.current[0]).toBe(false);
    rerender({ id: 'char-1' });
    expect(result.current[0]).toBe(true);
    currentPages = [];
    rerender({ id: 'char-1' });
    expect(result.current[0]).toBe(false);
  });

  it('does not roll back a new entity when an earlier toggle fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let rejectWrite: (error: Error) => void = () => {};
    setNotebookOpenMock.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectWrite = reject; }));
    const { result, rerender } = renderHook(
      ({ id }) => useNotebookOpen(id),
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
    setNotebookOpenMock.mockImplementationOnce(() => new Promise<void>(resolve => { finishWrite = resolve; }));
    const { result, rerender } = renderHook(() => useNotebookOpen('char-1'));
    act(() => result.current[1]());
    currentPages = [...currentPages];
    rerender();
    expect(result.current[0]).toBe(true);
    currentPages = ['other-char'];
    rerender();
    expect(result.current[0]).toBe(true);
    await act(async () => finishWrite());
    expect(result.current[0]).toBe(true);
    currentPages = ['other-char', 'char-1'];
    rerender();
    expect(result.current[0]).toBe(true);
    currentPages = ['other-char'];
    rerender();
    expect(result.current[0]).toBe(false);
  });

  it('keeps the latest of opposite toggles while earlier saves refresh the snapshot', async () => {
    let finishFirst: () => void = () => {};
    let finishSecond: () => void = () => {};
    setNotebookOpenMock
      .mockImplementationOnce(() => new Promise<void>(resolve => { finishFirst = resolve; }))
      .mockImplementationOnce(() => new Promise<void>(resolve => { finishSecond = resolve; }));
    const { result, rerender } = renderHook(() => useNotebookOpen('char-1'));
    act(() => result.current[1]());
    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
    currentPages = ['char-1'];
    rerender();
    await act(async () => finishFirst());
    expect(result.current[0]).toBe(false);
    await act(async () => finishSecond());
    expect(result.current[0]).toBe(false);
    currentPages = [];
    rerender();
    expect(result.current[0]).toBe(false);
  });

});
