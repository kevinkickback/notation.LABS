import {
  NOTIFICATION_HISTORY_COUNT,
  NOTIFICATION_RETENTION_MS,
  type NotificationInput,
  notificationEventSchema,
  notificationSchema,
} from '@/lib/notifications/types';
import { db } from './database';

async function prune(now: number): Promise<void> {
  await db.notifications
    .where('createdAt')
    .belowOrEqual(now - NOTIFICATION_RETENTION_MS)
    .delete();
  const excess = await db.notifications
    .orderBy('createdAt')
    .reverse()
    .offset(NOTIFICATION_HISTORY_COUNT)
    .primaryKeys();
  await db.notifications.bulkDelete(excess);
}

export const notificationRepository = {
  async record(input: NotificationInput, now = Date.now()): Promise<void> {
    const event = input.event && notificationEventSchema.parse(input.event);
    await db.transaction(
      'rw',
      db.notifications,
      db.notificationCursors,
      async () => {
        if (
          event &&
          (await db.notificationCursors.get(event.source))?.eventId === event.id
        ) {
          await prune(now);
          return;
        }
        const previous = await db.notifications.get(input.id);
        if (
          !previous ||
          event ||
          previous.createdAt <= now - NOTIFICATION_RETENTION_MS ||
          previous.message !== input.message ||
          previous.type !== input.type ||
          previous.action?.type !== input.action?.type
        ) {
          await db.notifications.put(
            notificationSchema.parse({
              ...input,
              createdAt: now,
              read: !['warning', 'error', 'update'].includes(input.type),
            }),
          );
        }
        await prune(now);
        if (event)
          await db.notificationCursors.put({
            id: event.source,
            eventId: event.id,
          });
      },
    );
  },
  async list(now = Date.now()) {
    const rows = await db.notifications
      .where('createdAt')
      .above(now - NOTIFICATION_RETENTION_MS)
      .reverse()
      .limit(NOTIFICATION_HISTORY_COUNT)
      .toArray();
    return rows.map((row) => notificationSchema.parse(row));
  },
  markAllRead: () => db.notifications.toCollection().modify({ read: true }),
  remove: (id: string) => db.notifications.delete(id),
  clear: () => db.notifications.clear(),
  prune: (now = Date.now()) =>
    db.transaction('rw', db.notifications, () => prune(now)),
};
