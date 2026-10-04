// @vitest-environment node
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/storage/database';
import { notificationRepository } from '@/lib/storage/notificationRepository';
import { NOTIFICATION_RETENTION_MS } from '@/lib/notifications/types';
import { notify } from '@/lib/notifications';
import { clearNotifications, markNotificationsRead, removeNotification } from '@/lib/application/notificationCommands';
import { reportError } from '@/lib/errors';
import { captureBackup } from '../../helpers/backup';
import { importJsonBackup } from '@/lib/storage/jsonImport';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/errors', async original => ({ ...await original<typeof import('@/lib/errors')>(), reportError: vi.fn() }));
import { toast } from 'sonner';

beforeEach(async () => {
  vi.clearAllMocks();
  await Promise.all(db.tables.map(table => table.clear()));
});
afterEach(() => vi.restoreAllMocks());
const record = (id: string, type: 'error' | 'success' = 'error', message = id, now?: number) => notificationRepository.record({ id, type, message }, now);

describe('notification history storage', () => {
  it('upgrades an existing history database without losing history or library records', async () => {
    const stores = Object.fromEntries(db.tables.filter(table => table.name !== 'notificationCursors')
      .map(table => [table.name, [table.schema.primKey.src, ...table.schema.indexes.map(index => index.src)].join(',')]));
    await db.delete();
    const previous = new Dexie(db.name);
    previous.version(8).stores(stores);
    const message = { id: 'saved', type: 'error', message: 'Saved error', createdAt: Date.now(), read: true };
    await previous.table('notifications').put(message);
    await previous.table('games').put({ id: 'game', name: 'Preserved game', buttonLayout: ['A'], notationProfile: 'standard', createdAt: 1, updatedAt: 1 });
    previous.close();
    await db.open();
    expect(await db.notifications.get('saved')).toEqual(message);
    expect((await db.games.get('game'))?.name).toBe('Preserved game');
    await notificationRepository.record({ id: 'next', type: 'error', message: 'New error', event: { source: 'updater', id: 'next-event' } });
    expect(await db.notificationCursors.get('updater')).toEqual({ id: 'updater', eventId: 'next-event' });
  });

  it('captures feedback without a mounted panel and keeps routine confirmations read', async () => {
    notify.success('Game added');
    notify.error('Could not save');
    notify.error('Could not save');
    await vi.waitFor(async () => expect(await db.notifications.count()).toBe(3));
    const rows = await notificationRepository.list();
    expect(new Set(rows.map(row => row.id)).size).toBe(3);
    expect(rows.find(row => row.type === 'success')?.read).toBe(true);
    expect(rows.find(row => row.type === 'error')?.read).toBe(false);
    expect(toast.success).toHaveBeenCalledWith('Game added');
    expect(toast.error).toHaveBeenCalledWith('Could not save');
  });

  it('excludes validation and progress feedback when requested', async () => {
    notify.error('Name is required', { history: false });
    expect(toast.error).toHaveBeenCalledWith('Name is required');
    expect(await db.notifications.count()).toBe(0);
  });

  it('updates one operation, keeps distinct operations separate, and preserves read state for duplicate feedback', async () => {
    await record('first', 'success', 'Complete');
    await record('second', 'success', 'Complete');
    await record('first', 'error', 'Failed');
    await markNotificationsRead();
    const previous = await db.notifications.get('first');
    await record('first', 'error', 'Failed');
    expect(await db.notifications.get('first')).toEqual(previous);
    expect(await db.notifications.count()).toBe(2);
    await record('first', 'error', 'Retry failed');
    expect((await db.notifications.get('first'))?.read).toBe(false);
    await removeNotification('first');
    expect(await db.notifications.count()).toBe(1);
    await clearNotifications();
    expect(await db.notifications.count()).toBe(0);
  });

  it('retains only the newest 100 messages for up to 30 days and renews an expired operation', async () => {
    const now = Date.now();
    for (let index = 0; index < 105; index++) await record(`entry-${index}`, 'error', `Message ${index}`, now + index);
    const rows = await notificationRepository.list(now + 105);
    expect(rows).toHaveLength(100);
    expect(rows[0].id).toBe('entry-104');
    expect(rows[99].id).toBe('entry-5');
    await notificationRepository.prune(now + 105 + NOTIFICATION_RETENTION_MS);
    expect(await db.notifications.count()).toBe(0);
    await record('expired', 'error', 'Failure', now - NOTIFICATION_RETENTION_MS);
    await record('expired', 'error', 'Failure', now);
    expect((await db.notifications.get('expired'))?.createdAt).toBe(now);
  });

  it('keeps temporary feedback working when history storage fails without recursively notifying', async () => {
    vi.spyOn(notificationRepository, 'record').mockRejectedValueOnce(new Error('History storage failed'));
    notify.success('Library saved');
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledWith('notifications.record', expect.any(Error)));
    expect(toast.success).toHaveBeenCalledOnce();
    expect(toast.error).not.toHaveBeenCalled();
    expect(await db.notifications.count()).toBe(0);
  });

  it('never replays saved messages or includes device history in a library backup', async () => {
    await record('saved');
    const json = JSON.parse(await (await captureBackup()).text());
    expect(json.notifications).toBeUndefined();
    expect(json.notificationCursors).toBeUndefined();
    await importJsonBackup(JSON.stringify(json));
    expect((await notificationRepository.list()).map(row => row.id)).toEqual(['saved']);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('consumes update events atomically and does not recreate read or dismissed notices on reload', async () => {
    const input = { id: 'update-event:failure', type: 'error' as const, message: 'Check failed', event: { source: 'updater' as const, id: 'failure' } };
    await notificationRepository.record(input);
    await markNotificationsRead();
    const read = await db.notifications.get(input.id);
    await notificationRepository.record(input);
    expect(await db.notifications.get(input.id)).toEqual(read);
    await removeNotification(input.id);
    await notificationRepository.record(input);
    expect(await db.notifications.count()).toBe(0);
    await notificationRepository.record({ ...input, event: { source: 'updater', id: 'retry' } });
    expect((await db.notifications.get(input.id))?.read).toBe(false);
    await clearNotifications();
    await notificationRepository.record({ ...input, event: { source: 'updater', id: 'retry' } });
    expect(await db.notifications.count()).toBe(0);
  });

  it('does not consume an event if its history transaction fails', async () => {
    const input = { id: 'event', message: 'Check failed', type: 'error' as const, event: { source: 'updater' as const, id: 'failure' } };
    vi.spyOn(db.notificationCursors, 'put').mockRejectedValueOnce(new Error('Quota exceeded'));
    await expect(notificationRepository.record(input)).rejects.toThrow('Quota exceeded');
    expect(await db.notifications.count()).toBe(0);
    await notificationRepository.record(input);
    expect(await db.notifications.count()).toBe(1);
  });
});
