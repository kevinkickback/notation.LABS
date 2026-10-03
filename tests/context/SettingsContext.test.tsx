import { act, fireEvent, render, type RenderResult, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type ReactNode, StrictMode } from 'react';

import {
  SettingsProvider,
  useSettings,
  useSettingsActions,
  useSettingsInitialization,
} from '@/context/SettingsContext';
import { DEFAULT_SETTINGS } from '@/lib/defaults';

const { settingsUpdateMock, notebookOpenMock, useLiveQueryMock } = vi.hoisted(() => ({
  settingsUpdateMock: vi.fn(),
  notebookOpenMock: vi.fn(),
  useLiveQueryMock: vi.fn(),
}));
const initMock = vi.fn();
const getMock = vi.fn();
const toastErrorMock = vi.fn();
const reportErrorMock = vi.fn();

async function renderSettings(ui: ReactNode): Promise<RenderResult> {
  let result: RenderResult | undefined;
  await act(async () => { result = render(ui); });
  if (!result) throw new Error('Settings provider did not render');
  return result;
}

vi.mock('@/hooks/useRecoverableLiveQuery', () => ({
  useRecoverableLiveQuery: (...args: unknown[]) => {
    const result = useLiveQueryMock(...args);
    return { error: result.error, data: result.data === undefined ? undefined : { settings: result.data, appliedThrough: result.appliedThrough ?? 0 } };
  },
}));

vi.mock('@/lib/storage/indexedDbStorage', () => ({
  indexedDbStorage: {
    settings: {
      get: (...args: unknown[]) => getMock(...args),
      update: (...args: unknown[]) => settingsUpdateMock(...args),
      setNotebookOpen: (...args: unknown[]) => notebookOpenMock(...args),
    },
  },
}));

vi.mock('@/lib/application/initializeApplication', () => ({
  initializeApplication: (...args: unknown[]) => initMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('@/lib/errors', () => ({
  reportError: (...args: unknown[]) => reportErrorMock(...args),
  toUserMessage: (err: unknown) =>
    err instanceof Error ? err.message : 'An unexpected error occurred',
}));

describe('SettingsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsUpdateMock.mockResolvedValue(undefined);
    notebookOpenMock.mockResolvedValue(undefined);
    useLiveQueryMock.mockReturnValue({ data: DEFAULT_SETTINGS, error: null });
    getMock.mockResolvedValue(DEFAULT_SETTINGS);
    initMock.mockResolvedValue(undefined);
    document.documentElement.style.removeProperty('--app-font-family');
    document.documentElement.style.removeProperty('--accent-color');
    document.documentElement.style.removeProperty('--accent-foreground');
    document.documentElement.classList.remove('dark');
  });

  function SettingsConsumer() {
    const settings = useSettings();
    const { setSetting } = useSettingsActions();

    return (
      <>
        <span>{settings.accentColor}</span>
        <button
          type="button"
          onClick={() => void setSetting('accentColor', '#abcdef')}
        >
          Change accent
        </button>
      </>
    );
  }

  function NotesConsumer() {
    const settings = useSettings();
    const { setSetting, setNotesPanelOpen } = useSettingsActions();
    return <>
      <span>{String(settings.notebookDocked)}</span>
      <button type="button" onClick={() => void setSetting('notebookDocked', true)}>Dock notebook</button>
      <button type="button" onClick={() => void setNotesPanelOpen('char-1', false)}>Close panel</button>
      <button type="button" onClick={() => void setNotesPanelOpen('char-1', true).catch(() => {})}>Open panel</button>
    </>;
  }

  it('initializes storage once when StrictMode replays effects', async () => {
    await renderSettings(<StrictMode><SettingsProvider><div>child</div></SettingsProvider></StrictMode>);
    await waitFor(() => expect(initMock).toHaveBeenCalledOnce());
  });

  it('retries a failed startup before marking preferences ready', async () => {
    initMock.mockRejectedValueOnce(new Error('temporary storage error'));
    function StartupConsumer() {
      const { initialized, error, retry } = useSettingsInitialization();
      return <><span>{initialized ? 'Ready' : 'Loading'}</span><span>{error}</span><button type="button" onClick={retry}>Retry</button></>;
    }
    await renderSettings(<SettingsProvider><StartupConsumer /></SettingsProvider>);
    await waitFor(() => expect(screen.getByText('temporary storage error')).toBeTruthy());
    expect(screen.getByText('Loading')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('Ready')).toBeTruthy());
    expect(initMock).toHaveBeenCalledTimes(2);
  });

  it('applies saved presentation settings to the document', async () => {
    useLiveQueryMock.mockReturnValue({ data: {
      ...DEFAULT_SETTINGS,
      fontFamily: 'verdana',
      accentColor: '#123456',
      colorTheme: 'dark',
    }, error: null });

    await renderSettings(
      <SettingsProvider>
        <div>child</div>
      </SettingsProvider>,
    );

    expect(
      document.documentElement.style.getPropertyValue('--app-font-family'),
    ).toBe('Verdana, Geneva, sans-serif');
    expect(
      document.documentElement.style.getPropertyValue('--accent-color'),
    ).toBe('#123456');
    expect(document.documentElement.style.getPropertyValue('--accent-foreground')).toBe('#fff');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('passes reparse lifecycle callbacks to application initialization', async () => {
    await renderSettings(
      <SettingsProvider>
        <div>child</div>
      </SettingsProvider>,
    );

    await waitFor(() => {
      expect(initMock).toHaveBeenCalledWith(
        expect.objectContaining({
          onReparseStart: expect.any(Function),
          onReparseEnd: expect.any(Function),
        }),
      );
    });
  });

  it('exposes a settings read failure and retries the subscription with initialization', async () => {
    useLiveQueryMock.mockReturnValue({ data: undefined, error: 'Settings read failed' });
    function Consumer() {
      const { initialized, error, retry } = useSettingsInitialization();
      return <><span>{initialized ? 'Ready' : 'Loading'}</span><span>{error}</span><button type="button" onClick={retry}>Retry read</button></>;
    }
    const { rerender } = await renderSettings(<SettingsProvider><Consumer /></SettingsProvider>);
    expect(screen.getByText('Settings read failed')).toBeTruthy();
    expect(screen.getByText('Loading')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry read' }));
    expect(useLiveQueryMock).toHaveBeenCalledWith(expect.any(Function), [0], 1);
    useLiveQueryMock.mockReturnValue({ data: DEFAULT_SETTINGS, error: null });
    rerender(<SettingsProvider><Consumer /></SettingsProvider>);
    await waitFor(() => expect(screen.getByText('Ready')).toBeTruthy());
    expect(initMock).toHaveBeenCalledTimes(2);
  });

  it('shows and hides the reparse progress modal using init callbacks', async () => {
    let reparseControls:
      | {
        onReparseStart: () => void;
        onReparseEnd: () => void;
      }
      | undefined;

    initMock.mockImplementationOnce(async (options) => {
      reparseControls = options as {
        onReparseStart: () => void;
        onReparseEnd: () => void;
      };
    });

    const { queryByText } = await renderSettings(
      <SettingsProvider>
        <div>child</div>
      </SettingsProvider>,
    );

    await waitFor(() => {
      expect(reparseControls).toBeDefined();
    });

    expect(queryByText('Updating Combo Parsing...')).toBeNull();

    act(() => {
      reparseControls?.onReparseStart();
    });
    await waitFor(() => {
      expect(queryByText('Updating Combo Parsing...')).toBeTruthy();
      expect(
        queryByText('Editing is temporarily disabled during this update.'),
      ).toBeTruthy();
    });

    act(() => {
      reparseControls?.onReparseEnd();
    });
    await waitFor(() => {
      expect(queryByText('Updating Combo Parsing...')).toBeNull();
    });
  });

  it('shows a toast when settings initialization fails', async () => {
    initMock.mockRejectedValueOnce(new Error('db unavailable'));

    await renderSettings(
      <SettingsProvider>
        <div>child</div>
      </SettingsProvider>,
    );

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        'Failed to load saved settings: db unavailable',
      );
      expect(reportErrorMock).toHaveBeenCalledWith(
        'SettingsProvider.init',
        expect.any(Error),
      );
    });
  });

  it('applies settings optimistically while persistence is pending', async () => {
    let resolvePersistence: (() => void) | undefined;
    settingsUpdateMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolvePersistence = resolve;
        }),
    );

    await renderSettings(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Change accent' }));
    expect(screen.getByText('#abcdef')).not.toBeNull();
    expect(
      document.documentElement.style.getPropertyValue('--accent-color'),
    ).toBe('#abcdef');

    await waitFor(() => expect(resolvePersistence).toBeDefined());
    await act(async () => resolvePersistence?.());
  });

  it('rolls back optimistic settings and reports persistence failures', async () => {
    let rejectPersistence: ((error: Error) => void) | undefined;
    settingsUpdateMock.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectPersistence = reject;
        }),
    );

    await renderSettings(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Change accent' }));
    expect(screen.getByText('#abcdef')).not.toBeNull();

    await waitFor(() => expect(rejectPersistence).toBeDefined());
    await act(async () => rejectPersistence?.(new Error('write failed')));

    expect(
      screen.getByText(DEFAULT_SETTINGS.accentColor ?? '#3b82f6'),
    ).not.toBeNull();
    expect(reportErrorMock).toHaveBeenCalledWith(
      'SettingsProvider.setSetting',
      expect.any(Error),
    );
    expect(toastErrorMock).toHaveBeenCalledWith(
      'Failed to save setting: write failed',
    );
  });

  it('preserves page choices when a global docking change fails', async () => {
    const saved = { ...DEFAULT_SETTINGS, notebookDocked: false, notebookOpenPages: ['char-1'] };
    useLiveQueryMock.mockReturnValue({ data: saved, error: null });
    let rejectWrite: (error: Error) => void = () => {};
    settingsUpdateMock.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectWrite = reject; }));
    function Consumer() {
      const settings = useSettings();
      const { setSetting } = useSettingsActions();
      return <><span>{JSON.stringify([settings.notebookDocked, settings.notebookOpenPages])}</span><button type="button" onClick={() => void setSetting('notebookDocked', true)}>Dock notebook</button></>;
    }
    await renderSettings(<SettingsProvider><Consumer /></SettingsProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Dock notebook' }));
    expect(screen.getByText('[true,["char-1"]]')).toBeTruthy();
    await waitFor(() => expect(settingsUpdateMock).toHaveBeenCalledWith({ notebookDocked: true }));
    await act(async () => rejectWrite(new Error('write failed')));
    expect(screen.getByText('[false,["char-1"]]')).toBeTruthy();
  });

  it('allows live page choices to update after a saved docking preference', async () => {
    useLiveQueryMock.mockReturnValue({ data: { ...DEFAULT_SETTINGS, notebookOpenPages: ['char-1'] }, error: null });
    function Consumer() {
      const settings = useSettings();
      const { setSetting } = useSettingsActions();
      return <><span>{JSON.stringify(settings.notebookOpenPages)}</span><button type="button" onClick={() => void setSetting('notebookDocked', true)}>Dock notebook</button></>;
    }
    const { rerender } = await renderSettings(<SettingsProvider><Consumer /></SettingsProvider>);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Dock notebook' })));
    useLiveQueryMock.mockReturnValue({ data: { ...DEFAULT_SETTINGS, notebookDocked: true, notebookOpenPages: ['char-1'] }, appliedThrough: 1, error: null });
    rerender(<SettingsProvider><Consumer /></SettingsProvider>);
    expect(screen.getByText('["char-1"]')).toBeTruthy();
    useLiveQueryMock.mockReturnValue({ data: { ...DEFAULT_SETTINGS, notebookDocked: true, notebookOpenPages: ['char-2'] }, appliedThrough: 1, error: null });
    rerender(<SettingsProvider><Consumer /></SettingsProvider>);
    expect(screen.getByText('["char-2"]')).toBeTruthy();
  });

  it('saves a docking side and mode atomically and rolls both back without changing page choices', async () => {
    useLiveQueryMock.mockReturnValue({ data: { ...DEFAULT_SETTINGS, notebookOpenPages: ['char-1'] }, error: null });
    let rejectWrite: (error: Error) => void = () => {};
    settingsUpdateMock.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectWrite = reject; }));
    function Consumer() {
      const settings = useSettings();
      const { setSettings } = useSettingsActions();
      return <><span>{JSON.stringify([settings.notebookDocked, settings.notebookDockSide, settings.notebookOpenPages])}</span><button type="button" onClick={() => void setSettings({ notebookDocked: true, notebookDockSide: 'left' })}>Dock left</button></>;
    }
    await renderSettings(<SettingsProvider><Consumer /></SettingsProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Dock left' }));
    expect(screen.getByText('[true,"left",["char-1"]]')).toBeTruthy();
    await waitFor(() => expect(settingsUpdateMock).toHaveBeenCalledExactlyOnceWith({ notebookDocked: true, notebookDockSide: 'left' }));
    await act(async () => rejectWrite(new Error('write failed')));
    expect(screen.getByText('[false,"right",["char-1"]]')).toBeTruthy();
  });

  it('keeps a newer grouped placement when an earlier grouped write fails', async () => {
    let rejectWrite: (error: Error) => void = () => {};
    settingsUpdateMock.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectWrite = reject; }));
    function Consumer() {
      const settings = useSettings();
      const { setSettings } = useSettingsActions();
      return <><span>{JSON.stringify([settings.notebookDocked, settings.notebookDockSide])}</span>{(['left', 'right'] as const).map(side => <button key={side} type="button" onClick={() => void setSettings({ notebookDocked: true, notebookDockSide: side })}>Dock {side}</button>)}</>;
    }
    await renderSettings(<SettingsProvider><Consumer /></SettingsProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Dock left' }));
    await waitFor(() => expect(settingsUpdateMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Dock right' }));
    await act(async () => rejectWrite(new Error('write failed')));
    await waitFor(() => expect(settingsUpdateMock).toHaveBeenCalledWith({ notebookDocked: true, notebookDockSide: 'right' }));
    expect(screen.getByText('[true,"right"]')).toBeTruthy();
  });

  it('saves a later page choice after a pending docking change', async () => {
    let finishDefault: () => void = () => {};
    settingsUpdateMock.mockImplementationOnce(() => new Promise<void>(resolve => { finishDefault = resolve; }));
    getMock.mockResolvedValue({ ...DEFAULT_SETTINGS, notebookDocked: true });
    await renderSettings(<SettingsProvider><NotesConsumer /></SettingsProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Dock notebook' }));
    await waitFor(() => expect(settingsUpdateMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(notebookOpenMock).not.toHaveBeenCalled();
    await act(async () => finishDefault());
    await waitFor(() => expect(notebookOpenMock).toHaveBeenCalledWith('char-1', false));
  });

  it('saves a later docking change after a pending page choice', async () => {
    let finishPanel: () => void = () => {};
    notebookOpenMock.mockImplementationOnce(() => new Promise<void>(resolve => { finishPanel = resolve; }));
    await renderSettings(<SettingsProvider><NotesConsumer /></SettingsProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Open panel' }));
    await waitFor(() => expect(notebookOpenMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Dock notebook' }));
    expect(settingsUpdateMock).not.toHaveBeenCalled();
    await act(async () => finishPanel());
    await waitFor(() => expect(settingsUpdateMock).toHaveBeenCalledWith({ notebookDocked: true }));
  });

  it('preserves a page choice after an earlier docking change fails', async () => {
    let failDefault: (error: Error) => void = () => {};
    settingsUpdateMock.mockImplementationOnce(() => new Promise((_resolve, reject) => { failDefault = reject; }));
    getMock.mockResolvedValue({ ...DEFAULT_SETTINGS, notebookDocked: false });
    await renderSettings(<SettingsProvider><NotesConsumer /></SettingsProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Dock notebook' }));
    await waitFor(() => expect(settingsUpdateMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    await act(async () => failDefault(new Error('write failed')));
    await waitFor(() => expect(notebookOpenMock).toHaveBeenCalledWith('char-1', false));
    expect(screen.getByText('false')).toBeTruthy();
  });

  it('continues the settings queue after a failed manual panel write', async () => {
    notebookOpenMock.mockRejectedValueOnce(new Error('panel write failed'));
    await renderSettings(<SettingsProvider><NotesConsumer /></SettingsProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Open panel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dock notebook' }));
    await waitFor(() => expect(settingsUpdateMock).toHaveBeenCalledWith({ notebookDocked: true }));
  });

  function CardSizeConsumer() {
    const settings = useSettings();
    const { setSetting } = useSettingsActions();
    return <><span data-testid="card-size">{settings.gameCardSize}</span>{[180, 190].map(size => <button type="button" key={size} onClick={() => void setSetting('gameCardSize', size)}>Size {size}</button>)}</>;
  }

  it.each([false, true])('keeps the latest repeated size while earlier writes finish (first fails: %s)', async firstFails => {
    const writes: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
    settingsUpdateMock.mockImplementation(() => new Promise<void>((resolve, reject) => { writes.push({ resolve, reject }); }));
    const { rerender } = await renderSettings(<SettingsProvider><CardSizeConsumer /></SettingsProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Size 180' }));
    fireEvent.click(screen.getByRole('button', { name: 'Size 190' }));
    fireEvent.click(screen.getByRole('button', { name: 'Size 180' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    await act(async () => firstFails ? writes[0].reject(new Error('first write failed')) : writes[0].resolve());
    await waitFor(() => expect(writes).toHaveLength(2));
    useLiveQueryMock.mockReturnValue({ data: { ...DEFAULT_SETTINGS, gameCardSize: 180 }, appliedThrough: 1, error: null });
    rerender(<SettingsProvider><CardSizeConsumer /></SettingsProvider>);
    expect(screen.getByTestId('card-size').textContent).toBe('180');
    await act(async () => writes[1].resolve());
    await waitFor(() => expect(writes).toHaveLength(3));
    useLiveQueryMock.mockReturnValue({ data: { ...DEFAULT_SETTINGS, gameCardSize: 190 }, appliedThrough: 2, error: null });
    rerender(<SettingsProvider><CardSizeConsumer /></SettingsProvider>);
    expect(screen.getByTestId('card-size').textContent).toBe('180');
    await act(async () => writes[2].resolve());
    useLiveQueryMock.mockReturnValue({ data: { ...DEFAULT_SETTINGS, gameCardSize: 180 }, appliedThrough: 3, error: null });
    rerender(<SettingsProvider><CardSizeConsumer /></SettingsProvider>);
    expect(screen.getByTestId('card-size').textContent).toBe('180');
    useLiveQueryMock.mockReturnValue({ data: { ...DEFAULT_SETTINGS, gameCardSize: 240 }, appliedThrough: 3, error: null });
    rerender(<SettingsProvider><CardSizeConsumer /></SettingsProvider>);
    expect(screen.getByTestId('card-size').textContent).toBe('240');
  });

  it('acknowledges docking while a later save updates remembered pages', async () => {
    getMock.mockResolvedValue({ ...DEFAULT_SETTINGS, notebookDocked: true });
    function Consumer() {
      const settings = useSettings();
      const { setSetting, setNotesPanelOpen } = useSettingsActions();
      return <><span>{JSON.stringify([settings.notebookDocked, settings.notebookOpenPages])}</span><button type="button" onClick={() => void setSetting('notebookDocked', true)}>Dock notebook</button><button type="button" onClick={() => void setNotesPanelOpen('char-1', true)}>Open panel</button></>;
    }
    const { rerender } = await renderSettings(<SettingsProvider><Consumer /></SettingsProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Dock notebook' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open panel' }));
    await waitFor(() => expect(notebookOpenMock).toHaveBeenCalledWith('char-1', true));
    useLiveQueryMock.mockReturnValue({ data: { ...DEFAULT_SETTINGS, notebookDocked: true, notebookOpenPages: ['char-1'] }, appliedThrough: 2, error: null });
    rerender(<SettingsProvider><Consumer /></SettingsProvider>);
    expect(screen.getByText('[true,["char-1"]]')).toBeTruthy();
  });
});
