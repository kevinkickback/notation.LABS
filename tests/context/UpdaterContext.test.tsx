import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceStatus } from '@/components/shared/WorkspaceStatus';
import { UpdaterProvider, useUpdater } from '@/context/UpdaterContext';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { INITIAL_UPDATE_STATUS, type UpdateStatus } from '@/lib/updater/ipcContract';
import { updateDetails, updateSnapshot } from '../helpers/updater';

const { reportErrorMock } = vi.hoisted(() => ({ reportErrorMock: vi.fn() }));
const settings = { ...DEFAULT_SETTINGS };
vi.mock('@/context/SettingsContext', () => ({ useSettings: () => settings }));
vi.mock('@/lib/errors', () => ({ reportError: reportErrorMock }));

function StatusProbe() {
  const { status, availabilityEventId, showAvailableUpdate, checkForUpdate } = useUpdater();
  return <div>
    <span data-testid="status">{status.status}</span>
    <span>{status.update?.version}</span>
    <span data-testid="availability">{availabilityEventId}</span>
    <button onClick={() => showAvailableUpdate()}>Show update</button>
    <button onClick={() => { void checkForUpdate(); }}>Check</button>
  </div>;
}

describe('UpdaterProvider', () => {
  let listener: ((status: UpdateStatus) => void) | null;
  const unsubscribe = vi.fn();
  const setAutoCheck = vi.fn();
  const originalApi = window.electronAPI;
  const available = updateDetails({ changelog: 'Saved release notes' });
  beforeEach(() => {
    vi.clearAllMocks();
    listener = null;
    settings.autoUpdate = true;
    setAutoCheck.mockResolvedValue(undefined);
    window.electronAPI = {
      platform: 'win32', versions: { electron: '1', chrome: '1', node: '1' },
      checkForUpdate: vi.fn(), downloadUpdate: vi.fn().mockResolvedValue({ success: true, data: null, error: null }),
      cancelUpdate: vi.fn(), installUpdate: vi.fn(), getUpdateStatus: vi.fn().mockResolvedValue(INITIAL_UPDATE_STATUS),
      setAutoCheck, getAppVersion: vi.fn().mockResolvedValue('1.8.0'), getCurrentChangelog: vi.fn(),
      onUpdateStatus: callback => { listener = callback; return unsubscribe; },
      saveFile: vi.fn(), beginBackup: vi.fn(), writeBackupChunk: vi.fn(), finishBackup: vi.fn(), abortBackup: vi.fn(),
    };
  });
  afterEach(() => { vi.restoreAllMocks(); window.electronAPI = originalApi; });

  function emit(status: UpdateStatus) { act(() => listener?.(status)); }
  async function mountFooter() {
    const view = render(<UpdaterProvider><WorkspaceStatus /></UpdaterProvider>);
    await waitFor(() => expect(listener).not.toBeNull());
    return view;
  }

  it('keeps the main-process update details through an offline check error', async () => {
    const network = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    await mountFooter();
    emit(updateSnapshot({ status: 'available', update: available }, 1, 1));
    act(() => { network.mockReturnValue(false); window.dispatchEvent(new Event('offline')); });
    emit(updateSnapshot({ status: 'checking', update: available }, 2, 1));
    emit(updateSnapshot({ status: 'error', update: available, error: 'Network unreachable' }, 3, 1));
    const details = screen.getByRole('button', { name: 'Update v2.0.0 available' });
    expect(details.title).toBe('Network unreachable');
    fireEvent.click(details);
    expect(screen.getByText('Saved release notes')).toBeTruthy();
  });

  it('clears confirmed metadata only when the main snapshot clears it', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await mountFooter();
    emit(updateSnapshot({ status: 'error', update: updateDetails({ status: 'downloaded' }), error: 'Check failed' }, 2));
    expect(screen.getByText('Update ready to install').title).toBe('Check failed');
    emit(updateSnapshot({ status: 'not-available', update: null }, 3));
    expect(screen.queryByText('Update ready to install')).toBeNull();
    expect(screen.getByText('Offline · updates unavailable')).toBeTruthy();
  });

  it('ignores a delayed initial snapshot after a newer complete live snapshot', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    let resolveInitial: (status: UpdateStatus) => void = () => {};
    vi.mocked(window.electronAPI.getUpdateStatus).mockReturnValue(new Promise(resolve => { resolveInitial = resolve; }));
    await mountFooter();
    emit(updateSnapshot({ status: 'error', update: available, error: 'Newer error' }, 5, 1));
    await act(async () => resolveInitial(updateSnapshot({ status: 'not-available', update: null }, 1)));
    expect(screen.getByRole('button', { name: 'Update v2.0.0 available' }).title).toBe('Newer error');
  });

  it('does not resurrect old metadata after a newer successful check', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    let resolveInitial: (status: UpdateStatus) => void = () => {};
    vi.mocked(window.electronAPI.getUpdateStatus).mockReturnValue(new Promise(resolve => { resolveInitial = resolve; }));
    await mountFooter();
    emit(updateSnapshot({ status: 'not-available', update: null }, 3));
    await act(async () => resolveInitial(updateSnapshot({ status: 'available', update: available }, 1)));
    expect(screen.queryByRole('button', { name: 'Update v2.0.0 available' })).toBeNull();
  });

  it('does not let a delayed command reply overwrite newer live download state', async () => {
    let resolveCheck: (result: { success: boolean; data: UpdateStatus; error: null }) => void = () => {};
    vi.mocked(window.electronAPI.checkForUpdate).mockReturnValue(new Promise(resolve => { resolveCheck = resolve; }));
    render(<UpdaterProvider><StatusProbe /></UpdaterProvider>);
    await waitFor(() => expect(listener).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    emit(updateSnapshot({ status: 'downloaded', update: updateDetails({ status: 'downloaded' }) }, 4));
    await act(async () => resolveCheck({ success: true, data: updateSnapshot({ status: 'available', update: available }, 2), error: null }));
    expect(screen.getByTestId('status').textContent).toBe('downloaded');
  });

  it('updates an open release presentation when delayed notes arrive', async () => {
    await mountFooter();
    emit(updateSnapshot({ status: 'available', update: updateDetails({ changelog: null, changelogLoading: true }) }, 1, 1));
    fireEvent.click(screen.getByRole('button', { name: 'Update v2.0.0 available' }));
    expect(screen.queryByText('Saved release notes')).toBeNull();
    emit(updateSnapshot({ status: 'available', update: available }, 2, 1));
    expect(screen.getByText('Saved release notes')).toBeTruthy();
  });

  it('starts saved updates without replacing authoritative status with optimistic state', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    let resolveDownload: (result: { success: boolean; data: null; error: null }) => void = () => {};
    vi.mocked(window.electronAPI.downloadUpdate).mockReturnValue(new Promise(resolve => { resolveDownload = resolve; }));
    await mountFooter();
    emit(updateSnapshot({ status: 'error', update: available, error: 'Old network error' }, 1, 1));
    fireEvent.click(screen.getByRole('button', { name: 'Update v2.0.0 available' }));
    fireEvent.click(screen.getByRole('button', { name: 'Install Now' }));
    expect(screen.getByText('Downloading v2.0.0...')).toBeTruthy();
    expect(screen.queryByText('Update Failed')).toBeNull();
    emit(updateSnapshot({ status: 'downloading', update: available, progress: { percentage: 20, bytesPerSecond: 10, transferred: 20, total: 100 } }, 2, 1));
    expect(screen.getByText('20%')).toBeTruthy();
    await act(async () => resolveDownload({ success: true, data: null, error: null }));
  });

  it('clears earlier presentation errors during retry and handles rejected IPC', async () => {
    const failure = new Error('IPC disconnected');
    let rejectDownload: (error: Error) => void = () => {};
    vi.mocked(window.electronAPI.downloadUpdate)
      .mockResolvedValueOnce({ success: true, data: null, error: null })
      .mockReturnValueOnce(new Promise((_resolve, reject) => { rejectDownload = reject; }));
    render(<UpdaterProvider><StatusProbe /></UpdaterProvider>);
    await waitFor(() => expect(listener).not.toBeNull());
    emit(updateSnapshot({ status: 'available', update: available }, 1, 1));
    fireEvent.click(screen.getByRole('button', { name: 'Show update' }));
    fireEvent.click(screen.getByRole('button', { name: 'Install Now' }));
    await waitFor(() => expect(window.electronAPI.downloadUpdate).toHaveBeenCalledOnce());
    emit(updateSnapshot({ status: 'error', update: available, error: 'Download error' }, 2, 1));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByText('Downloading v2.0.0...')).toBeTruthy();
    await act(async () => rejectDownload(failure));
    expect(screen.getByText('Update Failed')).toBeTruthy();
    expect(reportErrorMock).toHaveBeenCalledWith('UpdaterProvider.downloadUpdate', failure);
    expect(screen.getByTestId('status').textContent).toBe('error');
  });

  it('keeps a downloaded update after closing its progress presentation', async () => {
    const view = await mountFooter();
    emit(updateSnapshot({ status: 'available', update: available }, 1));
    fireEvent.click(screen.getByRole('button', { name: 'Update v2.0.0 available' }));
    fireEvent.click(screen.getByRole('button', { name: 'Install Now' }));
    emit(updateSnapshot({ status: 'downloaded', update: updateDetails({ status: 'downloaded' }) }, 3));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Update Ready')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Update ready to install' }));
    expect(screen.getByText('Update Ready')).toBeTruthy();
    view.unmount();
  });

  it('owns one subscription and forwards availability identity without replaying it', async () => {
    const view = render(<UpdaterProvider><StatusProbe /></UpdaterProvider>);
    await waitFor(() => expect(listener).not.toBeNull());
    emit(updateSnapshot({ status: 'available', update: available }, 1, 1));
    emit(updateSnapshot({ status: 'available', update: available }, 2, 1));
    expect(screen.getByTestId('availability').textContent).toBe('1');
    expect(setAutoCheck).toHaveBeenCalledWith(true);
    view.unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('forwards disabled auto-check settings and reports IPC failures', async () => {
    const failure = new Error('IPC unavailable');
    settings.autoUpdate = false;
    setAutoCheck.mockRejectedValueOnce(failure);
    render(<UpdaterProvider><StatusProbe /></UpdaterProvider>);
    await waitFor(() => expect(reportErrorMock).toHaveBeenCalledWith('UpdaterProvider.setAutoCheck', failure));
    expect(setAutoCheck).toHaveBeenCalledWith(false);
  });

  it('keeps portable downloads out of the installer workflow', async () => {
    render(<UpdaterProvider><StatusProbe /></UpdaterProvider>);
    await waitFor(() => expect(listener).not.toBeNull());
    emit(updateSnapshot({ status: 'available', update: updateDetails({ isPortable: true }) }, 1));
    fireEvent.click(screen.getByRole('button', { name: 'Show update' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Download Page' }));
    await waitFor(() => expect(window.electronAPI.downloadUpdate).toHaveBeenCalledOnce());
    expect(screen.queryByText('Downloading v2.0.0...')).toBeNull();
  });
});
