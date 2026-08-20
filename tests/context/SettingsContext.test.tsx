import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SettingsProvider,
  useSettings,
  useSettingsActions,
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

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (...args: unknown[]) => useLiveQueryMock(...args),
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
    useLiveQueryMock.mockReturnValue(DEFAULT_SETTINGS);
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

  it('applies saved presentation settings to the document', () => {
    useLiveQueryMock.mockReturnValue({
      ...DEFAULT_SETTINGS,
      fontFamily: 'verdana',
      accentColor: '#123456',
      colorTheme: 'dark',
    });

    render(
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
    render(
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

    const { queryByText } = render(
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

    render(
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

    render(
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

    render(
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
});
