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

const { settingsUpdateMock, useLiveQueryMock } = vi.hoisted(() => ({
  settingsUpdateMock: vi.fn(),
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
  useRecoverableLiveQuery: (...args: unknown[]) => useLiveQueryMock(...args),
}));

vi.mock('@/lib/storage/indexedDbStorage', () => ({
  indexedDbStorage: {
    settings: {
      init: (...args: unknown[]) => initMock(...args),
      get: (...args: unknown[]) => getMock(...args),
      update: (...args: unknown[]) => settingsUpdateMock(...args),
      setNotesOverride: vi.fn(),
    },
  },
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
    useLiveQueryMock.mockReturnValue({ data: DEFAULT_SETTINGS, error: null });
    getMock.mockResolvedValue(DEFAULT_SETTINGS);
    initMock.mockResolvedValue(undefined);
    document.documentElement.style.removeProperty('--app-font-family');
    document.documentElement.style.removeProperty('--accent-color');
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
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('passes reparse lifecycle callbacks to settings init', async () => {
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
    expect(useLiveQueryMock).toHaveBeenCalledWith(expect.any(Function), [], 1);
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

  it('resets notes overrides with the global default and rolls both back on failure', async () => {
    const saved = { ...DEFAULT_SETTINGS, notesDefaultOpen: false, notesOverrides: ['char-1'] };
    useLiveQueryMock.mockReturnValue({ data: saved, error: null });
    let rejectWrite: (error: Error) => void = () => {};
    settingsUpdateMock.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectWrite = reject; }));
    function Consumer() {
      const settings = useSettings();
      const { setSetting } = useSettingsActions();
      return <><span>{JSON.stringify([settings.notesDefaultOpen, settings.notesOverrides])}</span><button type="button" onClick={() => void setSetting('notesDefaultOpen', true)}>Open notes</button></>;
    }
    await renderSettings(<SettingsProvider><Consumer /></SettingsProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Open notes' }));
    expect(screen.getByText('[true,[]]')).toBeTruthy();
    expect(settingsUpdateMock).toHaveBeenCalledWith({ notesDefaultOpen: true, notesOverrides: [] });
    await act(async () => rejectWrite(new Error('write failed')));
    expect(screen.getByText('[false,["char-1"]]')).toBeTruthy();
  });

  it('releases the optimistic override reset once saved, allowing new panel choices', async () => {
    useLiveQueryMock.mockReturnValue({ data: { ...DEFAULT_SETTINGS, notesOverrides: ['char-1'] }, error: null });
    function Consumer() {
      const settings = useSettings();
      const { setSetting } = useSettingsActions();
      return <><span>{JSON.stringify(settings.notesOverrides)}</span><button type="button" onClick={() => void setSetting('notesDefaultOpen', true)}>Open notes</button></>;
    }
    const { rerender } = await renderSettings(<SettingsProvider><Consumer /></SettingsProvider>);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Open notes' })));
    useLiveQueryMock.mockReturnValue({ data: { ...DEFAULT_SETTINGS, notesDefaultOpen: true, notesOverrides: [] }, error: null });
    rerender(<SettingsProvider><Consumer /></SettingsProvider>);
    expect(screen.getByText('[]')).toBeTruthy();
    useLiveQueryMock.mockReturnValue({ data: { ...DEFAULT_SETTINGS, notesDefaultOpen: true, notesOverrides: ['char-2'] }, error: null });
    rerender(<SettingsProvider><Consumer /></SettingsProvider>);
    expect(screen.getByText('["char-2"]')).toBeTruthy();
  });
});
