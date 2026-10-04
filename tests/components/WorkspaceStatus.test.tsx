import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceStatus } from '@/components/shared/WorkspaceStatus';
import type { UpdateDetails, UpdateStatus } from '@/lib/updater/ipcContract';

import { updateDetails, updateSnapshot } from '../helpers/updater';
vi.mock('@/components/shared/NotificationHistory', () => ({ NotificationHistory: () => null }));

const updater = vi.hoisted(() => ({ status: { status: 'idle' } as UpdateStatus, knownUpdate: null as UpdateDetails | null, showAvailableUpdate: vi.fn() }));
const originalElectronApi = window.electronAPI;
vi.mock('@/context/UpdaterContext', () => ({ useUpdater: () => updater }));

describe('Workspace status', () => {
  beforeEach(() => {
    updater.status = updateSnapshot({ status: 'idle', update: null });
    updater.knownUpdate = null;
    updater.showAvailableUpdate.mockClear();
    Reflect.deleteProperty(window, 'electronAPI');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    window.electronAPI = originalElectronApi;
  });

  it('reports actual update state and opens available update details', async () => {
    const user = userEvent.setup();
    const view = render(<WorkspaceStatus />);
    expect(screen.queryByText('Current version')).toBeNull();
    expect(view.container.querySelector('.update-status')).toBeNull();
    expect(screen.getByText(`v${__APP_VERSION__}`)).not.toBeNull();
    updater.status = updateSnapshot({ status: 'not-available', update: null });
    view.rerender(<WorkspaceStatus />);
    expect(screen.getByText('Up to date').getAttribute('data-state')).toBe('current');
    updater.status = updateSnapshot({ status: 'available', update: updateDetails() });
    view.rerender(<WorkspaceStatus />);
    await user.click(screen.getByRole('button', { name: 'Update v2.0.0 available' }));
    expect(updater.showAvailableUpdate).toHaveBeenCalledOnce();
    updater.status = updateSnapshot({ status: 'downloading', update: updateDetails(), progress: { percentage: 43.6, transferred: 44, total: 100, bytesPerSecond: 5 } });
    view.rerender(<WorkspaceStatus />);
    expect(screen.getByText('Downloading update · 44%')).not.toBeNull();
    updater.status = updateSnapshot({ status: 'error', update: null, error: 'Offline' });
    view.rerender(<WorkspaceStatus />);
    expect(screen.getByText('Update error').title).toBe('Offline');
  });

  it('shows the version before update status', () => {
    updater.status = updateSnapshot({ status: 'not-available', update: null });
    render(<WorkspaceStatus />);
    const status = screen.getByRole('status');
    expect(Array.from(status.children).map(element => element.textContent)).toEqual([`v${__APP_VERSION__}`, 'Up to date']);
  });

  it.each([false, true])('opens a retained ready installer after an error with online=%s', async online => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
    const update = updateDetails({ status: 'downloaded' });
    updater.status = updateSnapshot({ status: 'error', update, error: 'Transient failure' });
    updater.knownUpdate = update;
    render(<WorkspaceStatus />);
    const ready = screen.getByRole('button', { name: 'Update ready to install' });
    expect(ready.title).toBe('Transient failure');
    await userEvent.setup().click(ready);
    expect(updater.showAvailableUpdate).toHaveBeenCalledWith(update);
  });

  it('reacts to network loss and recovery without disabling search', () => {
    const network = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    render(<WorkspaceStatus />);
    act(() => {
      network.mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText('Offline · updates unavailable')).not.toBeNull();
    act(() => {
      network.mockReturnValue(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText('Offline · updates unavailable')).toBeNull();
  });

  it('shows the installed version supplied by the desktop bridge', async () => {
    window.electronAPI = { getAppVersion: vi.fn().mockResolvedValue('1.9.2') } as unknown as Window['electronAPI'];
    render(<WorkspaceStatus />);
    expect(await screen.findByText('v1.9.2')).not.toBeNull();
  });

  it('omits image-search status from the footer', () => {
    const view = render(<WorkspaceStatus />);
    expect(view.container.querySelector('.image-search-status')).toBeNull();
    expect(screen.queryByText(/Image search/)).toBeNull();
  });

  it('keeps known update and downloaded states when offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    updater.status = updateSnapshot({ status: 'available', update: updateDetails() });
    const view = render(<WorkspaceStatus />);
    expect(screen.getByRole('button', { name: 'Update v2.0.0 available' })).not.toBeNull();
    updater.status = updateSnapshot({ status: 'downloaded', update: updateDetails({ status: 'downloaded' }) });
    view.rerender(<WorkspaceStatus />);
    expect(screen.getByText('Update ready to install').getAttribute('data-state')).toBe('active');
    expect(screen.queryByText('Offline · updates unavailable')).toBeNull();
  });

  it('does not present a successful check as current after network loss', () => {
    const network = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    updater.status = updateSnapshot({ status: 'not-available', update: null });
    render(<WorkspaceStatus />);
    act(() => {
      network.mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.queryByText('Up to date')).toBeNull();
    expect(screen.getByText('Offline · updates unavailable').getAttribute('data-state')).toBe('offline');
  });

  it('preserves error details when offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    updater.status = updateSnapshot({ status: 'error', update: null, error: 'Download checksum mismatch' });
    render(<WorkspaceStatus />);
    expect(screen.getByText('Offline · updates unavailable').title).toBe('Download checksum mismatch');
  });
});
