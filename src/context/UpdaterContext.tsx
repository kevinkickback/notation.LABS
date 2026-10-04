import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ChangelogModal } from '@/components/updates/ChangelogModal';
import { UpdateProgressModal } from '@/components/updates/UpdateProgressModal';
import { useSettings } from '@/context/SettingsContext';
import { recordNotification } from '@/lib/application/notificationCommands';
import { reportError } from '@/lib/errors';
import { notify } from '@/lib/notifications';
import {
  INITIAL_UPDATE_STATUS,
  type UpdateDetails,
  type UpdateIPCResponse,
  type UpdateStatus,
} from '@/lib/updater/ipcContract';

interface ChangelogPresentation {
  version: string;
  changelog: string | null;
  loading?: boolean;
  installable?: boolean;
  isPortable?: boolean;
}
interface UpdaterController {
  status: UpdateStatus;
  knownUpdate: UpdateDetails | null;
  availabilityEventId: number;
  checkForUpdate: () => Promise<UpdateStatus>;
  downloadUpdate: () => Promise<UpdateIPCResponse<null>>;
  cancelUpdate: () => Promise<UpdateIPCResponse<null>>;
  installUpdate: () => Promise<void>;
  showAvailableUpdate: (update?: UpdateDetails | null) => void;
  showChangelog: (presentation: ChangelogPresentation) => void;
  dismissChangelog: () => void;
}
const UNAVAILABLE_RESPONSE: UpdateIPCResponse<null> = {
  success: false,
  data: null,
  error: 'Updates are unavailable in this environment.',
};
const UpdaterContext = createContext<UpdaterController>({
  status: INITIAL_UPDATE_STATUS,
  knownUpdate: null,
  availabilityEventId: 0,
  checkForUpdate: () =>
    Promise.reject(
      new Error(UNAVAILABLE_RESPONSE.error ?? 'Updates unavailable'),
    ),
  downloadUpdate: async () => UNAVAILABLE_RESPONSE,
  cancelUpdate: async () => UNAVAILABLE_RESPONSE,
  installUpdate: async () => undefined,
  showAvailableUpdate: () => undefined,
  showChangelog: () => undefined,
  dismissChangelog: () => undefined,
});

export function UpdaterProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const [status, setStatus] = useState<UpdateStatus>(INITIAL_UPDATE_STATUS);
  const latestStatus = useRef(status);
  const [changelogPresentation, setChangelogPresentation] =
    useState<ChangelogPresentation | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);
  const [downloadStarting, setDownloadStarting] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const downloadPromise = useRef<Promise<UpdateIPCResponse<null>> | null>(null);

  const receiveStatus = useCallback((next: UpdateStatus) => {
    if (next.revision <= latestStatus.current.revision)
      return latestStatus.current;
    const previous = latestStatus.current;
    const terminalChanged =
      next.status !== previous.status ||
      next.update?.version !== previous.update?.version ||
      next.error !== previous.error;
    latestStatus.current = next;
    setStatus(next);
    const event = next.eventId
      ? { source: 'updater' as const, id: next.eventId }
      : undefined;
    if (terminalChanged && next.status === 'available') {
      void recordNotification({
        id: `update:${next.update.version}`,
        message: `Update v${next.update.version} available`,
        type: 'update',
        action: { type: 'view-update' },
        event,
      });
    } else if (terminalChanged && next.status === 'downloaded' && next.update) {
      void recordNotification({
        id: `update:${next.update.version}`,
        message: `Update v${next.update.version} ready to install`,
        type: 'update',
        action: { type: 'view-update' },
        event,
      });
    } else if (terminalChanged && next.status === 'error' && next.error) {
      void recordNotification({
        id: next.update
          ? `update:${next.update.version}`
          : `update-event:${next.eventId}`,
        message: next.error,
        type: 'error',
        action: next.update ? { type: 'view-update' } : undefined,
        event,
      });
    }
    if (
      ['downloading', 'downloaded', 'error', 'cancelled'].includes(next.status)
    )
      setDownloadStarting(false);
    return next;
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    let active = true;
    const unsubscribe = api.onUpdateStatus((next) => {
      if (active) receiveStatus(next);
    });
    void api
      .getUpdateStatus()
      .then((next) => {
        if (active) receiveStatus(next);
      })
      .catch((error) => reportError('UpdaterProvider.getStatus', error));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [receiveStatus]);

  useEffect(() => {
    void window.electronAPI
      ?.setAutoCheck(settings.autoUpdate)
      .catch((error) => reportError('UpdaterProvider.setAutoCheck', error));
  }, [settings.autoUpdate]);

  const checkForUpdate = useCallback(async () => {
    const check = window.electronAPI?.checkForUpdate;
    if (!check)
      throw new Error(UNAVAILABLE_RESPONSE.error ?? 'Updates unavailable');
    const result = await check();
    if (!result.success || !result.data)
      throw new Error(result.error ?? 'Could not check for updates.');
    return receiveStatus(result.data);
  }, [receiveStatus]);

  const downloadUpdate = useCallback((): Promise<UpdateIPCResponse<null>> => {
    if (downloadPromise.current) return downloadPromise.current;
    const download = window.electronAPI?.downloadUpdate;
    if (!download) return Promise.resolve(UNAVAILABLE_RESPONSE);
    setDownloadStarting(true);
    setDownloadError(null);
    const request = Promise.resolve()
      .then(download)
      .then((result) => {
        if (!result.success)
          setDownloadError(result.error ?? 'Could not start the update.');
        return result;
      })
      .catch((error) => {
        reportError('UpdaterProvider.downloadUpdate', error);
        const result = {
          success: false,
          data: null,
          error: 'Could not start the update.',
        };
        setDownloadError(result.error);
        return result;
      })
      .finally(() => {
        setDownloadStarting(false);
        downloadPromise.current = null;
      });
    downloadPromise.current = request;
    return request;
  }, []);

  const cancelUpdate = useCallback(
    () =>
      window.electronAPI?.cancelUpdate() ??
      Promise.resolve(UNAVAILABLE_RESPONSE),
    [],
  );
  const installUpdate = useCallback(async () => {
    await window.electronAPI?.installUpdate();
  }, []);
  const showAvailableUpdate = useCallback(
    (update = latestStatus.current.update) => {
      if (
        update?.status === 'downloaded' ||
        (latestStatus.current.status === 'downloading' &&
          update === latestStatus.current.update)
      ) {
        setProgressOpen(true);
        return;
      }
      if (update?.status !== 'available') return;
      setChangelogPresentation({
        version: update.version,
        changelog: update.changelog,
        loading: update.changelogLoading,
        installable: true,
        isPortable: update.isPortable,
      });
    },
    [],
  );
  const showChangelog = useCallback((presentation: ChangelogPresentation) => {
    setChangelogPresentation(presentation);
  }, []);
  const dismissChangelog = useCallback(() => {
    setChangelogPresentation(null);
  }, []);
  // Keep an open update presentation current when its release notes arrive.
  const presentedUpdate = changelogPresentation?.installable
    ? status.update
    : null;
  const presentedVersion =
    presentedUpdate?.version ?? changelogPresentation?.version ?? '';
  const presentedPortable =
    presentedUpdate?.isPortable ?? changelogPresentation?.isPortable;

  const startPresentedDownload = useCallback(async () => {
    if (!changelogPresentation?.installable) return;
    setChangelogPresentation(null);
    if (!latestStatus.current.update?.isPortable) setProgressOpen(true);
    const result = await downloadUpdate();
    if (!result.success) {
      const update = latestStatus.current.update;
      notify.error(result.error ?? 'Could not start the update.', {
        history: !(
          latestStatus.current.status === 'error' &&
          latestStatus.current.error === result.error
        ),
        operationId: update ? `update:${update.version}` : undefined,
        historyAction: update ? { type: 'view-update' } : undefined,
      });
    }
  }, [changelogPresentation, downloadUpdate]);

  return (
    <UpdaterContext.Provider
      value={{
        status,
        knownUpdate: status.update,
        availabilityEventId: status.availabilityEventId,
        checkForUpdate,
        downloadUpdate,
        cancelUpdate,
        installUpdate,
        showAvailableUpdate,
        showChangelog,
        dismissChangelog,
      }}
    >
      {children}
      <ChangelogModal
        open={changelogPresentation !== null}
        onOpenChange={(open) => {
          if (!open) setChangelogPresentation(null);
        }}
        version={presentedVersion}
        changelog={
          presentedUpdate
            ? presentedUpdate.changelog
            : (changelogPresentation?.changelog ?? null)
        }
        loading={
          presentedUpdate
            ? presentedUpdate.changelogLoading
            : changelogPresentation?.loading
        }
        onInstall={
          changelogPresentation?.installable &&
          status.update?.status === 'available'
            ? () => {
                void startPresentedDownload();
              }
            : undefined
        }
        installLabel={presentedPortable ? 'Open Download Page' : undefined}
      />
      <UpdateProgressModal
        open={progressOpen}
        version={status.update?.version ?? ''}
        status={status}
        starting={downloadStarting}
        error={downloadError}
        onOpenChange={setProgressOpen}
        onCancel={cancelUpdate}
        onRetry={downloadUpdate}
        onInstall={installUpdate}
      />
    </UpdaterContext.Provider>
  );
}
export const useUpdater = () => useContext(UpdaterContext);
