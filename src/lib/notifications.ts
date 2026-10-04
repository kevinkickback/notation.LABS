import { toast } from 'sonner';
import { recordNotification } from '@/lib/application/notificationCommands';
import type {
  NotificationAction,
  NotificationType,
} from './notifications/types';

type NotificationOptions = Parameters<typeof toast.success>[1] & {
  history?: boolean;
  operationId?: string;
  historyAction?: NotificationAction;
};

function emit(
  type: NotificationType,
  message: string,
  options: NotificationOptions = {},
) {
  const {
    history = true,
    operationId,
    historyAction,
    ...toastOptions
  } = options;
  const method = type === 'update' ? 'info' : type;
  const result =
    operationId || Object.keys(toastOptions).length
      ? toast[method](
          message,
          operationId ? { ...toastOptions, id: operationId } : toastOptions,
        )
      : toast[method](message);
  if (history)
    void recordNotification({
      id: operationId,
      message,
      type,
      action: historyAction,
    });
  return result;
}

export const notify = {
  success: (message: string, options?: NotificationOptions) =>
    emit('success', message, options),
  info: (message: string, options?: NotificationOptions) =>
    emit('info', message, options),
  warning: (message: string, options?: NotificationOptions) =>
    emit('warning', message, options),
  error: (message: string, options?: NotificationOptions) =>
    emit('error', message, options),
  update: (message: string, options?: NotificationOptions) =>
    emit('update', message, options),
};
