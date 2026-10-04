import {
  BellIcon,
  CheckCircleIcon,
  CopyIcon,
  InfoIcon,
  WarningIcon,
  XCircleIcon,
  XIcon,
} from '@phosphor-icons/react';
import * as Popover from '@radix-ui/react-popover';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useUpdater } from '@/context/UpdaterContext';
import { useRecoverableLiveQuery } from '@/hooks/useRecoverableLiveQuery';
import {
  clearNotifications,
  markNotificationsRead,
  pruneNotifications,
  removeNotification,
} from '@/lib/application/notificationCommands';
import { reportError } from '@/lib/errors';
import { notify } from '@/lib/notifications';
import { notificationRepository } from '@/lib/storage/notificationRepository';

const types = {
  success: { label: 'Success', Icon: CheckCircleIcon },
  info: { label: 'Information', Icon: InfoIcon },
  warning: { label: 'Warning', Icon: WarningIcon },
  error: { label: 'Error', Icon: XCircleIcon },
  update: { label: 'Update', Icon: InfoIcon },
};

export function NotificationHistory() {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [clock, setClock] = useState(Date.now);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const { knownUpdate, showAvailableUpdate } = useUpdater();
  const { data: entries, error } = useRecoverableLiveQuery(
    () => notificationRepository.list(clock),
    [clock],
    attempt,
  );
  const unread = entries?.filter((entry) => !entry.read).length ?? 0;
  useEffect(() => {
    void pruneNotifications();
    const timer = setInterval(() => {
      setClock(Date.now());
      void pruneNotifications();
    }, 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (error) reportError('notifications.read', new Error(error));
  }, [error]);

  const act = async (operation: () => Promise<unknown>) => {
    const focused = document.activeElement;
    try {
      await operation();
      if (
        document.activeElement === focused ||
        (document.activeElement === document.body &&
          (focused?.isConnected === false ||
            (focused instanceof HTMLButtonElement && focused.disabled)))
      ) {
        closeRef.current?.focus();
      }
    } catch (failure) {
      reportError('notifications.action', failure);
      notify.error('Could not update notification history. Please retry.', {
        history: false,
      });
    }
  };
  const copyError = async (message: string) => {
    try {
      await navigator.clipboard.writeText(message);
      notify.success('Error copied', { history: false });
    } catch (failure) {
      reportError('notifications.copy', failure);
      notify.error('Could not copy the error. Please retry.', {
        history: false,
      });
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="notification-bell relative ml-auto size-6"
          aria-label={
            unread ? `Notifications, ${unread} unread` : 'Notifications'
          }
          title="Notification history"
        >
          <BellIcon aria-hidden="true" size={18} />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-0 top-0 size-2 rounded-full bg-primary"
            />
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={10}
          collisionPadding={12}
          aria-labelledby={titleId}
          className="notification-history z-50 flex w-[400px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg outline-none"
        >
          <div className="flex items-center justify-between gap-3 border-b p-3">
            <h2 id={titleId} className="font-semibold">
              Notifications
            </h2>
            <Popover.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Close notifications"
                ref={closeRef}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </Popover.Close>
          </div>
          {entries && entries.length > 0 && (
            <div className="flex gap-2 border-b px-3 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!unread}
                onClick={() => void act(markNotificationsRead)}
              >
                Mark all read
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void act(clearNotifications)}
              >
                Clear history
              </Button>
            </div>
          )}
          <div className="min-h-0 overflow-y-auto overscroll-contain">
            {error ? (
              <div className="space-y-2 p-4">
                <p>Could not load notification history.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  Try again
                </Button>
              </div>
            ) : !entries ? (
              <p className="p-5 text-sm text-muted-foreground">
                Loading notifications…
              </p>
            ) : entries.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">
                No notifications yet.
              </p>
            ) : (
              <ol className="divide-y">
                {entries.map((entry) => {
                  const { label, Icon } = types[entry.type];
                  return (
                    <li
                      key={entry.id}
                      className="p-3"
                      data-unread={!entry.read || undefined}
                    >
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Icon size={16} aria-hidden="true" />{' '}
                        <span>{label}</span>
                        {!entry.read && (
                          <span className="font-medium text-foreground">
                            Unread
                          </span>
                        )}
                        <time
                          className="ml-auto"
                          dateTime={new Date(entry.createdAt).toISOString()}
                          title={new Date(entry.createdAt).toLocaleString()}
                        >
                          {new Date(entry.createdAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </time>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          aria-label={`Remove notification: ${entry.message}`}
                          onClick={() =>
                            void act(() => removeNotification(entry.id))
                          }
                        >
                          <XIcon aria-hidden="true" />
                        </Button>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">
                        {entry.message}
                      </p>
                      {(entry.type === 'error' ||
                        (entry.action?.type === 'view-update' &&
                          knownUpdate)) && (
                        <div className="mt-2 flex gap-2">
                          {entry.type === 'error' && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void copyError(entry.message)}
                            >
                              <CopyIcon aria-hidden="true" />
                              Copy error
                            </Button>
                          )}
                          {entry.action?.type === 'view-update' &&
                            knownUpdate && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setOpen(false);
                                  showAvailableUpdate();
                                }}
                              >
                                View update
                              </Button>
                            )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
