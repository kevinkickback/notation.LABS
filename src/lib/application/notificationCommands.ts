import { reportError } from '@/lib/errors';
import type { NotificationInput } from '@/lib/notifications/types';
import { notificationRepository } from '@/lib/storage/notificationRepository';
import { generateId } from '@/lib/storage/repositoryUtils';

/** History cannot turn a successful library operation into a failure. */
export async function recordNotification(
  input: Omit<NotificationInput, 'id'> & { id?: string },
): Promise<void> {
  try {
    await notificationRepository.record({
      ...input,
      id: input.id ?? generateId(),
    });
  } catch (error) {
    reportError('notifications.record', error);
  }
}
export async function pruneNotifications(): Promise<void> {
  try {
    await notificationRepository.prune();
  } catch (error) {
    reportError('notifications.prune', error);
  }
}
export const markNotificationsRead = () => notificationRepository.markAllRead();
export const removeNotification = (id: string) =>
  notificationRepository.remove(id);
export const clearNotifications = () => notificationRepository.clear();
