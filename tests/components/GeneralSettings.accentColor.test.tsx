import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { UpdaterProvider } from '@/context/UpdaterContext';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkForUpdateMock = vi.fn();
const getCurrentChangelogMock = vi.fn();
const setSettingMock = vi.fn();

vi.mock('@/context/SettingsContext', () => ({
  useSettings: () => DEFAULT_SETTINGS,
  useSettingsActions: () => ({ setSetting: setSettingMock }),
}));

vi.mock('@/components/ui/select', async () => {
  const React = await import('react');
  const SelectContext = React.createContext<{
    value: string;
    onValueChange: (value: string) => void;
  }>({
    value: '',
    onValueChange: () => { },
  });

  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value: string;
      onValueChange: (value: string) => void;
      children: ReactNode;
    }) => (
      <SelectContext.Provider value={{ value, onValueChange }}>
        {children}
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    SelectValue: () => {
      const { value } = React.useContext(SelectContext);
      return <span>{value}</span>;
    },
    SelectContent: ({ children }: { children: ReactNode }) => {
      const { value, onValueChange } = React.useContext(SelectContext);
      return (
        <select
          aria-label="mock-select"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
        >
          {children}
        </select>
      );
    },
    SelectItem: ({
      value,
      children,
    }: {
      value: string;
      children: ReactNode;
    }) => <option value={value}>{children}</option>,
  };
});

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('GeneralSettings accent color', () => {
  beforeEach(() => {
    checkForUpdateMock.mockReset();
    getCurrentChangelogMock.mockReset();
    setSettingMock.mockReset();
    setSettingMock.mockResolvedValue(true);
    window.electronAPI = {
      platform: 'win32',
      versions: {
        electron: '40.0.0',
        chrome: '140.0.0',
        node: '22.0.0',
      },
      checkForUpdate: checkForUpdateMock,
      downloadUpdate: vi.fn(),
      cancelUpdate: vi.fn(),
      installUpdate: vi.fn(),
      getUpdateStatus: vi.fn().mockResolvedValue({ status: 'idle' }),
      setAutoCheck: vi.fn().mockResolvedValue(undefined),
      getAppVersion: vi.fn().mockResolvedValue('1.3.0'),
      getCurrentChangelog: getCurrentChangelogMock.mockResolvedValue({
        version: '1.3.0',
        changelog: 'Notes',
      }),
      onUpdateChecking: vi.fn(() => () => { }),
      onUpdateAvailable: vi.fn(() => () => { }),
      onUpdateNotAvailable: vi.fn(() => () => { }),
      onUpdateError: vi.fn(() => () => { }),
      onDownloadProgress: vi.fn(() => () => { }),
      onUpdateDownloaded: vi.fn(() => () => { }),
      onUpdateCancelled: vi.fn(() => () => { }),
      saveFile: vi.fn(),
    };
  });

  const renderGeneralSettings = () =>
    render(
      <UpdaterProvider>
        <GeneralSettings />
      </UpdaterProvider>,
    );

  it('renders accent color picker and requests persistence', async () => {
    renderGeneralSettings();
    // Wait for settings to load
    expect(await screen.findByLabelText(/accent color picker/i)).not.toBeNull();
    const colorInput = screen.getByLabelText(
      /accent color picker/i,
    ) as HTMLInputElement;
    // Simulate color change
    fireEvent.change(colorInput, { target: { value: '#ff0000' } });
    await waitFor(() => {
      expect(setSettingMock).toHaveBeenCalledWith('accentColor', '#ff0000');
    });
  });

  it('shows update check failure instead of up-to-date on failed responses', async () => {
    checkForUpdateMock.mockResolvedValue({
      success: false,
      data: null,
      error: 'network down',
    });

    renderGeneralSettings();

    fireEvent.click(await screen.findByRole('button', { name: /check now/i }));

    expect(await screen.findByText(/check failed/i)).not.toBeNull();
    expect(screen.queryByText(/up to date/i)).toBeNull();
  });

  it('requests persistence when the theme changes', async () => {
    renderGeneralSettings();

    const selects = await screen.findAllByLabelText('mock-select');
    fireEvent.change(selects[0], { target: { value: 'light' } });

    await waitFor(() => {
      expect(setSettingMock).toHaveBeenCalledWith('colorTheme', 'light');
    });
  });

  it('requests persistence when the font changes', async () => {
    renderGeneralSettings();

    const selects = await screen.findAllByLabelText('mock-select');
    fireEvent.change(selects[1], { target: { value: 'jetbrains-mono' } });

    await waitFor(() => {
      expect(setSettingMock).toHaveBeenCalledWith(
        'fontFamily',
        'jetbrains-mono',
      );
    });
  });

  it('loads the current changelog in electron mode', async () => {
    renderGeneralSettings();

    fireEvent.click(await screen.findByRole('button', { name: /^view$/i }));

    expect(getCurrentChangelogMock).toHaveBeenCalled();
    expect(await screen.findByText(/^Notes$/)).not.toBeNull();
  });
});
