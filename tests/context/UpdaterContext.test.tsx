import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceStatus } from '@/components/shared/WorkspaceStatus';
import { UpdaterProvider, useUpdater } from '@/context/UpdaterContext';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import type { UpdateStatus } from '@/lib/updater/ipcContract';

const { reportErrorMock } = vi.hoisted(() => ({
  reportErrorMock: vi.fn(),
}));
const settings = { ...DEFAULT_SETTINGS };

vi.mock('@/context/SettingsContext', () => ({
  useSettings: () => settings,
}));

vi.mock('@/lib/errors', () => ({
  reportError: reportErrorMock,
}));

function StatusProbe() {
  const { status, availabilityEventId, showAvailableUpdate } = useUpdater();
  return (
    <div>
      <span>{status.status}</span>
      <span>{status.version}</span>
      <span>{availabilityEventId}</span>
      <button type="button" onClick={() => showAvailableUpdate()}>
        Show update
      </button>
    </div>
  );
}

describe('UpdaterProvider', () => {
  const listeners = new Map<string, (data?: unknown) => void>();
  const unsubscribers: Array<ReturnType<typeof vi.fn>> = [];
  const setAutoCheck = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    listeners.clear();
    unsubscribers.length = 0;
    setAutoCheck.mockClear();
    reportErrorMock.mockClear();
    settings.autoUpdate = true;

    const subscribe =
      <T,>(name: string) =>
      (callback: (data: T) => void) => {
      listeners.set(name, (data) => callback(data as T));
      const unsubscribe = vi.fn();
      unsubscribers.push(unsubscribe);
      return unsubscribe;
    };

    window.electronAPI = {
      platform: 'win32',
      versions: { electron: '1', chrome: '1', node: '1' },
      checkForUpdate: vi.fn(),
      downloadUpdate: vi.fn(),
      cancelUpdate: vi.fn(),
      installUpdate: vi.fn(),
      getUpdateStatus: vi.fn().mockResolvedValue({ status: 'idle' }),
      setAutoCheck,
      getAppVersion: vi.fn().mockResolvedValue('1.8.0'),
      getCurrentChangelog: vi.fn(),
      onUpdateChecking: subscribe('checking'),
      onUpdateAvailable: subscribe('available'),
      onUpdateNotAvailable: subscribe('not-available'),
      onUpdateError: subscribe('error'),
      onDownloadProgress: subscribe('progress'),
      onUpdateDownloaded: subscribe('downloaded'),
      onUpdateCancelled: subscribe('cancelled'),
      saveFile: vi.fn(),
    beginBackup: vi.fn(), writeBackupChunk: vi.fn(), finishBackup: vi.fn(), abortBackup: vi.fn(),
    };
  });

  afterEach(() => vi.restoreAllMocks());

  it('keeps known update details through an offline checking/error transition', async () => {
    const network = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    render(<UpdaterProvider><WorkspaceStatus /></UpdaterProvider>);
    await waitFor(() => expect(listeners.size).toBe(7));
    act(() => {
      listeners.get('available')?.({ version: '2.0.0', changelog: 'Saved release notes', isPortable: false });
    });
    act(() => {
      network.mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));
      listeners.get('checking')?.();
    });
    expect(screen.getByRole('button', { name: 'Update v2.0.0 available' })).toBeTruthy();
    act(() => listeners.get('error')?.({ message: 'Network unreachable' }));
    const details = screen.getByRole('button', { name: 'Update v2.0.0 available' });
    expect(details.title).toBe('Network unreachable');
    fireEvent.click(details);
    expect(screen.getByText('Update Available — v2.0.0')).toBeTruthy();
    expect(screen.getByText('Saved release notes')).toBeTruthy();
  });

  it('preserves downloaded metadata through batched events and clears it after a successful check', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<UpdaterProvider><WorkspaceStatus /></UpdaterProvider>);
    await waitFor(() => expect(listeners.size).toBe(7));
    act(() => {
      listeners.get('available')?.({ version: '2.0.0', changelog: 'Saved notes', isPortable: false });
      listeners.get('downloaded')?.({ version: '2.0.0' });
      listeners.get('checking')?.();
      listeners.get('error')?.({ message: 'Check failed' });
    });
    expect(screen.getByText('Update ready to install').title).toBe('Check failed');
    act(() => listeners.get('not-available')?.());
    expect(screen.queryByText('Update ready to install')).toBeNull();
    expect(screen.getByText('Offline · updates unavailable')).toBeTruthy();
  });

  it('does not let an older initial snapshot discard a newer update event', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    let resolveInitial: (status: UpdateStatus) => void = () => {};
    vi.mocked(window.electronAPI!.getUpdateStatus).mockReturnValue(new Promise(resolve => { resolveInitial = resolve; }));
    render(<UpdaterProvider><WorkspaceStatus /></UpdaterProvider>);
    await waitFor(() => expect(listeners.size).toBe(7));
    act(() => {
      listeners.get('available')?.({ version: '2.0.0', changelog: 'New notes', isPortable: false });
      listeners.get('checking')?.();
    });
    await act(async () => resolveInitial({ status: 'not-available' }));
    expect(screen.getByRole('button', { name: 'Update v2.0.0 available' })).toBeTruthy();
  });

  it('owns subscriptions and maps update events into one state', async () => {
    const { unmount } = render(
      <UpdaterProvider>
        <StatusProbe />
      </UpdaterProvider>,
    );

    await waitFor(() => expect(listeners.size).toBe(7));
    expect(setAutoCheck).toHaveBeenCalledWith(true);

    act(() => {
      listeners.get('available')?.({
        version: '2.0.0',
        changelog: 'Changes',
        isPortable: false,
      });
    });

    expect(screen.getByText('available')).toBeTruthy();
    expect(screen.getByText('2.0.0')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();

    act(() => {
      listeners.get('progress')?.({
        percentage: 50,
        bytesPerSecond: 100,
        total: 200,
        transferred: 100,
      });
    });
    expect(screen.getByText('downloading')).toBeTruthy();

    unmount();
    for (const unsubscribe of unsubscribers) {
      expect(unsubscribe).toHaveBeenCalledOnce();
    }
  });

  it('forwards disabled auto-check settings and reports IPC failures', async () => {
    const error = new Error('IPC unavailable');
    settings.autoUpdate = false;
    setAutoCheck.mockRejectedValueOnce(error);

    render(
      <UpdaterProvider>
        <StatusProbe />
      </UpdaterProvider>,
    );

    await waitFor(() => expect(setAutoCheck).toHaveBeenCalledWith(false));
    expect(reportErrorMock).toHaveBeenCalledWith(
      'UpdaterProvider.setAutoCheck',
      error,
    );
  });

  it('owns update presentation and installer download orchestration', async () => {
    const downloadUpdate = vi.mocked(window.electronAPI?.downloadUpdate);
    downloadUpdate?.mockResolvedValue({ success: true, data: null, error: null });
    render(
      <UpdaterProvider>
        <StatusProbe />
      </UpdaterProvider>,
    );
    await waitFor(() => expect(listeners.has('available')).toBe(true));
    act(() => {
      listeners.get('available')?.({
        version: '2.0.0',
        changelog: 'Important fixes',
        isPortable: false,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Show update' }));
    expect(screen.getByText('Update Available — v2.0.0')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Install Now' }));

    await waitFor(() => expect(downloadUpdate).toHaveBeenCalledOnce());
    expect(screen.getByText('Downloading v2.0.0...')).toBeTruthy();
  });

  it('keeps portable downloads out of the installer progress workflow', async () => {
    const downloadUpdate = vi.mocked(window.electronAPI?.downloadUpdate);
    downloadUpdate?.mockResolvedValue({ success: true, data: null, error: null });
    render(
      <UpdaterProvider>
        <StatusProbe />
      </UpdaterProvider>,
    );
    await waitFor(() => expect(listeners.has('available')).toBe(true));
    act(() => {
      listeners.get('available')?.({
        version: '2.0.0',
        changelog: 'Portable fixes',
        isPortable: true,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Show update' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Open Download Page' }),
    );

    await waitFor(() => expect(downloadUpdate).toHaveBeenCalledOnce());
    expect(screen.queryByText('Downloading v2.0.0...')).toBeNull();
  });
});
