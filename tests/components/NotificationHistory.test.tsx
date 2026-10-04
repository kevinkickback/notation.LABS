import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationHistory } from '@/components/shared/NotificationHistory';
import { notificationRepository } from '@/lib/storage/notificationRepository';
import { db } from '@/lib/storage/database';
import { notify } from '@/lib/notifications';
import { toast } from 'sonner';
import { updateDetails } from '../helpers/updater';
import type { UpdateDetails } from '@/lib/updater/ipcContract';

const updater = vi.hoisted(() => ({ knownUpdate: null as UpdateDetails | null, showAvailableUpdate: vi.fn() }));
vi.mock('@/context/UpdaterContext', () => ({ useUpdater: () => updater }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/errors', async original => ({ ...await original<typeof import('@/lib/errors')>(), reportError: vi.fn() }));

beforeEach(async () => {
  updater.knownUpdate = null;
  updater.showAvailableUpdate.mockClear();
  await db.notifications.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('notification panel', () => {
  it('opens an empty panel with the keyboard and returns focus when Escape closes it', async () => {
    const user = userEvent.setup();
    render(<NotificationHistory />);
    const bell = screen.getByRole('button', { name: 'Notifications' });
    bell.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('No notifications yet.')).toBeTruthy();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(bell);
  });

  it('captures while closed and supports copying, reading, removing, and clearing messages', async () => {
    const user = userEvent.setup();
    render(<NotificationHistory />);
    await act(async () => {
      notify.error('Save failed');
      await vi.waitFor(async () => expect(await db.notifications.count()).toBe(1));
    });
    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    expect(await screen.findByText('Save failed')).toBeTruthy();
    const copy = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByRole('button', { name: 'Copy error' }));
    expect(copy).toHaveBeenCalledWith('Save failed');
    await user.click(screen.getByRole('button', { name: 'Mark all read' }));
    await waitFor(() => expect(screen.queryByText('Unread')).toBeNull());
    await user.click(screen.getByRole('button', { name: 'Remove notification: Save failed' }));
    expect(await screen.findByText('No notifications yet.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close notifications' }));
    await act(async () => notificationRepository.record({ id: 'next', message: 'Complete', type: 'success' }));
    expect(await screen.findByText('Complete')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Clear history' }));
    expect(await screen.findByText('No notifications yet.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close notifications' }));
  });

  it('resolves update actions through the current updater and hides expired actions', async () => {
    const user = userEvent.setup();
    await notificationRepository.record({ id: 'old', message: 'Update v1.0.0 available', type: 'update', action: { type: 'view-update' } });
    const view = render(<NotificationHistory />);
    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    expect(await screen.findByText('Update v1.0.0 available')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'View update' })).toBeNull();
    updater.knownUpdate = updateDetails({ version: '3.0.0' });
    view.rerender(<NotificationHistory />);
    await user.click(screen.getByRole('button', { name: 'View update' }));
    expect(updater.showAvailableUpdate).toHaveBeenCalledWith();
  });

  it('shows a retry when saved history cannot be read', async () => {
    vi.spyOn(notificationRepository, 'list').mockRejectedValueOnce(new Error('Read failed'));
    const user = userEvent.setup();
    render(<NotificationHistory />);
    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('Could not load notification history.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No notifications yet.')).toBeTruthy();
  });

  it('keeps failed management and clipboard feedback out of history', async () => {
    const user = userEvent.setup();
    await notificationRepository.record({ id: 'saved', message: 'Save failed', type: 'error' });
    render(<NotificationHistory />);
    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    await screen.findByText('Save failed');
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('Clipboard unavailable'));
    await user.click(screen.getByRole('button', { name: 'Copy error' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not copy the error. Please retry.'));
    vi.spyOn(notificationRepository, 'clear').mockRejectedValueOnce(new Error('Storage unavailable'));
    await user.click(screen.getByRole('button', { name: 'Clear history' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not update notification history. Please retry.'));
    expect(await db.notifications.count()).toBe(1);
    expect(screen.getByText('Save failed')).toBeTruthy();
  });
});
