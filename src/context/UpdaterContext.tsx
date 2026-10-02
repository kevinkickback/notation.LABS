import {
  createContext,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { toast } from 'sonner';
import { ChangelogModal } from '@/components/updates/ChangelogModal';
import { UpdateProgressModal } from '@/components/updates/UpdateProgressModal';
import { useSettings } from '@/context/SettingsContext';
import { reportError } from '@/lib/errors';
import type {
  UpdateIPCResponse,
  UpdateStatus,
} from '@/lib/updater/ipcContract';

interface UpdaterController {
  status: UpdateStatus;
  knownUpdate: UpdateStatus | null;
  availabilityEventId: number;
  checkForUpdate: () => Promise<UpdateStatus>;
  downloadUpdate: () => Promise<UpdateIPCResponse<null>>;
  cancelUpdate: () => Promise<UpdateIPCResponse<null>>;
  installUpdate: () => Promise<void>;
  showAvailableUpdate: (status?: UpdateStatus) => void;
  showChangelog: (presentation: ChangelogPresentation) => void;
  dismissChangelog: () => void;
  reset: () => void;
}

interface ChangelogPresentation {
  version: string;
  changelog: string | null;
  loading?: boolean;
  installable?: boolean;
  isPortable?: boolean;
}

const UNAVAILABLE_RESPONSE: UpdateIPCResponse<null> = {
  success: false,
  data: null,
  error: 'Updates are unavailable in this environment.',
};

const UpdaterContext = createContext<UpdaterController>({
  status: { status: 'idle' },
  knownUpdate: null,
  availabilityEventId: 0,
  checkForUpdate: async () => ({
    status: 'error',
    error: UNAVAILABLE_RESPONSE.error ?? undefined,
  }),
  downloadUpdate: async () => UNAVAILABLE_RESPONSE,
  cancelUpdate: async () => UNAVAILABLE_RESPONSE,
  installUpdate: async () => undefined,
  showAvailableUpdate: () => undefined,
  showChangelog: () => undefined,
  dismissChangelog: () => undefined,
  reset: () => undefined,
});

export function UpdaterProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const [{ status, knownUpdate }, setUpdateState] = useState<{
    status: UpdateStatus;
    knownUpdate: UpdateStatus | null;
  }>({ status: { status: 'idle' }, knownUpdate: null });
  // Keep confirmed metadata separately from transient checks/errors, atomically
  // with each event so batched events cannot discard a known update.
  const setStatus = useCallback((next: SetStateAction<UpdateStatus>) => {
    setUpdateState((current) => {
      const status = typeof next === 'function' ? next(current.status) : next;
      const knownUpdate =
        status.status === 'available'
          ? status
          : status.status === 'downloaded'
            ? { ...current.knownUpdate, ...status }
            : status.status === 'not-available'
              ? null
              : current.knownUpdate;
      return { status, knownUpdate };
    });
  }, []);
  const [availabilityEventId, setAvailabilityEventId] = useState(0);
  const [changelogPresentation, setChangelogPresentation] =
    useState<ChangelogPresentation | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    let active = true;
    let receivedEvent = false;
    const receiveStatus = (next: SetStateAction<UpdateStatus>) => {
      receivedEvent = true;
      setStatus(next);
    };

    void api
      .getUpdateStatus()
      .then((initialStatus) => {
        if (active && !receivedEvent) setStatus(initialStatus);
      })
      .catch((error) => reportError('UpdaterProvider.getStatus', error));

    const unsubscribers = [
      api.onUpdateChecking(() => receiveStatus({ status: 'checking' })),
      api.onUpdateAvailable((data) => {
        receiveStatus({
          status: 'available',
          version: data.version,
          changelog: data.changelog ?? undefined,
          isPortable: data.isPortable,
        });
        setAvailabilityEventId((current) => current + 1);
      }),
      api.onUpdateNotAvailable(() =>
        receiveStatus({ status: 'not-available' }),
      ),
      api.onUpdateError((data) =>
        receiveStatus({ status: 'error', error: data.message }),
      ),
      api.onDownloadProgress((progress) =>
        receiveStatus((current) => ({
          ...current,
          status: 'downloading',
          progress,
          error: undefined,
        })),
      ),
      api.onUpdateDownloaded((data) =>
        receiveStatus((current) => ({
          ...current,
          status: 'downloaded',
          version: data.version,
          progress: undefined,
        })),
      ),
      api.onUpdateCancelled(() =>
        receiveStatus((current) => ({
          ...current,
          status: 'cancelled',
          progress: undefined,
        })),
      ),
    ];

    return () => {
      active = false;
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, [setStatus]);

  useEffect(() => {
    const setAutoCheck = window.electronAPI?.setAutoCheck;
    if (!setAutoCheck) return;
    void setAutoCheck(settings.autoUpdate).catch((error) =>
      reportError('UpdaterProvider.setAutoCheck', error),
    );
  }, [settings.autoUpdate]);

  const checkForUpdate = useCallback(async (): Promise<UpdateStatus> => {
    const check = window.electronAPI?.checkForUpdate;
    if (!check) {
      const unavailable: UpdateStatus = {
        status: 'error',
        error: UNAVAILABLE_RESPONSE.error ?? undefined,
      };
      setStatus(unavailable);
      return unavailable;
    }

    const result = await check();
    const nextStatus =
      result.success && result.data
        ? result.data
        : {
            status: 'error' as const,
            error: result.error ?? 'Could not check for updates.',
          };
    setStatus(nextStatus);
    return nextStatus;
  }, [setStatus]);

  const downloadUpdate = useCallback(async () => {
    const download = window.electronAPI?.downloadUpdate;
    if (!download) return UNAVAILABLE_RESPONSE;
    const result = await download();
    if (!result.success) {
      setStatus((current) => ({
        ...current,
        status: 'error',
        error: result.error ?? 'Could not start the update.',
      }));
    }
    return result;
  }, [setStatus]);

  const cancelUpdate = useCallback(() => {
    const cancel = window.electronAPI?.cancelUpdate;
    if (!cancel) return Promise.resolve(UNAVAILABLE_RESPONSE);
    return cancel();
  }, []);

  const installUpdate = useCallback(async () => {
    await window.electronAPI?.installUpdate?.();
  }, []);

  const showAvailableUpdate = useCallback(
    (candidate: UpdateStatus = status) => {
      if (candidate.status !== 'available') return;
      setChangelogPresentation({
        version: candidate.version ?? '',
        changelog: candidate.changelog ?? null,
        installable: true,
        isPortable: candidate.isPortable,
      });
    },
    [status],
  );

  const showChangelog = useCallback((presentation: ChangelogPresentation) => {
    setChangelogPresentation(presentation);
  }, []);
  const dismissChangelog = useCallback(() => {
    setChangelogPresentation(null);
  }, []);

  const startPresentedDownload = useCallback(async () => {
    const isPortable = changelogPresentation?.isPortable ?? status.isPortable;
    setChangelogPresentation(null);
    if (!isPortable) setProgressOpen(true);
    try {
      const result = await downloadUpdate();
      if (!result.success) {
        setProgressOpen(false);
        toast.error(result.error ?? 'Could not start the update.');
      }
    } catch (error) {
      setProgressOpen(false);
      reportError('UpdaterProvider.downloadUpdate', error);
      toast.error('Could not start the update.');
    }
  }, [changelogPresentation?.isPortable, downloadUpdate, status.isPortable]);

  const handleProgressOpenChange = useCallback(
    (open: boolean) => {
      setProgressOpen(open);
      if (!open) setStatus({ status: 'idle' });
    },
    [setStatus],
  );

  const reset = useCallback(() => setStatus({ status: 'idle' }), [setStatus]);

  return (
    <UpdaterContext.Provider
      value={{
        status,
        knownUpdate,
        availabilityEventId,
        checkForUpdate,
        downloadUpdate,
        cancelUpdate,
        installUpdate,
        showAvailableUpdate,
        showChangelog,
        dismissChangelog,
        reset,
      }}
    >
      {children}
      <ChangelogModal
        open={changelogPresentation !== null}
        onOpenChange={(open) => !open && setChangelogPresentation(null)}
        version={changelogPresentation?.version ?? ''}
        changelog={changelogPresentation?.changelog ?? null}
        loading={changelogPresentation?.loading}
        onInstall={
          changelogPresentation?.installable
            ? () => void startPresentedDownload()
            : undefined
        }
        installLabel={
          changelogPresentation?.isPortable ? 'Open Download Page' : undefined
        }
      />
      <UpdateProgressModal
        open={progressOpen}
        version={status.version ?? changelogPresentation?.version ?? ''}
        onOpenChange={handleProgressOpenChange}
      />
    </UpdaterContext.Provider>
  );
}

export const useUpdater = () => useContext(UpdaterContext);
