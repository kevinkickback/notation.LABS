import { z } from 'zod';

export const NOTIFICATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const NOTIFICATION_HISTORY_COUNT = 100;
export const notificationTypeSchema = z.enum([
  'success',
  'info',
  'warning',
  'error',
  'update',
]);
export const notificationActionSchema = z.object({
  type: z.literal('view-update'),
});
export const notificationSchema = z.object({
  id: z.string().min(1),
  message: z.string(),
  type: notificationTypeSchema,
  createdAt: z.number().int().nonnegative().max(8_640_000_000_000_000),
  read: z.boolean(),
  action: notificationActionSchema.optional(),
});
export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type NotificationAction = z.infer<typeof notificationActionSchema>;
export type NotificationEntry = z.infer<typeof notificationSchema>;
export type NotificationInput = Pick<
  NotificationEntry,
  'id' | 'message' | 'type' | 'action'
>;
