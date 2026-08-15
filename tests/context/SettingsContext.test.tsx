import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsProvider } from '@/context/SettingsContext';
import { DEFAULT_SETTINGS } from '@/lib/defaults';

const { useLiveQueryMock } = vi.hoisted(() => ({
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
    useLiveQueryMock.mockReturnValue(DEFAULT_SETTINGS);
    getMock.mockResolvedValue(DEFAULT_SETTINGS);
    initMock.mockResolvedValue(undefined);
    document.documentElement.style.removeProperty('--app-font-family');
    document.documentElement.style.removeProperty('--accent-color');
    document.documentElement.classList.remove('dark');
  });

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
});
