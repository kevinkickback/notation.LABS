import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useSettings } from '@/context/SettingsContext';
import { reportError } from '@/lib/errors';
import type {
  UpdateIPCResponse,
  UpdateStatus,
} from '@/lib/updater/ipcContract';

interface UpdaterController {
  status: UpdateStatus;
  availabilityEventId: number;
  checkForUpdate: () => Promise<UpdateStatus>;
  downloadUpdate: () => Promise<UpdateIPCResponse<null>>;
  cancelUpdate: () => Promise<UpdateIPCResponse<null>>;
  installUpdate: () => Promise<void>;
  reset: () => void;
}

const UNAVAILABLE_RESPONSE: UpdateIPCResponse<null> = {
  success: false,
  data: null,
  error: 'Updates are unavailable in this environment.',
};

const UpdaterContext = createContext<UpdaterController>({
  status: { status: 'idle' },
  availabilityEventId: 0,
  checkForUpdate: async () => ({
    status: 'error',
    error: UNAVAILABLE_RESPONSE.error ?? undefined,
  }),
  downloadUpdate: async () => UNAVAILABLE_RESPONSE,
  cancelUpdate: async () => UNAVAILABLE_RESPONSE,
  installUpdate: async () => undefined,
  reset: () => undefined,
});

export function UpdaterProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const [status, setStatus] = useState<UpdateStatus>({ status: 'idle' });
  const [availabilityEventId, setAvailabilityEventId] = useState(0);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    void api
      .getUpdateStatus()
      .then(setStatus)
      .catch((error) => reportError('UpdaterProvider.getStatus', error));

    const unsubscribers = [
      api.onUpdateChecking(() => setStatus({ status: 'checking' })),
      api.onUpdateAvailable((data) => {
        setStatus({
          status: 'available',
          version: data.version,
          changelog: data.changelog ?? undefined,
          isPortable: data.isPortable,
        });
        setAvailabilityEventId((current) => current + 1);
      }),
      api.onUpdateNotAvailable(() => setStatus({ status: 'not-available' })),
      api.onUpdateError((data) =>
        setStatus({ status: 'error', error: data.message }),
      ),
      api.onDownloadProgress((progress) =>
        setStatus((current) => ({
          ...current,
          status: 'downloading',
          progress,
          error: undefined,
        })),
      ),
      api.onUpdateDownloaded((data) =>
        setStatus((current) => ({
          ...current,
          status: 'downloaded',
          version: data.version,
          progress: undefined,
        })),
      ),
      api.onUpdateCancelled(() =>
        setStatus((current) => ({
          ...current,
          status: 'cancelled',
          progress: undefined,
        })),
      ),
    ];

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, []);

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

    setStatus({ status: 'checking' });
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
  }, []);

  const downloadUpdate = useCallback(async () => {
    const download = window.electronAPI?.downloadUpdate;
    if (!download) return UNAVAILABLE_RESPONSE;
    setStatus((current) => ({
      ...current,
      status: 'downloading',
      progress: undefined,
      error: undefined,
    }));
    const result = await download();
    if (!result.success) {
      setStatus((current) => ({
        ...current,
        status: 'error',
        error: result.error ?? 'Could not start the update.',
      }));
    }
    return result;
  }, []);

  const cancelUpdate = useCallback(() => {
    const cancel = window.electronAPI?.cancelUpdate;
    if (!cancel) return Promise.resolve(UNAVAILABLE_RESPONSE);
    return cancel();
  }, []);

  const installUpdate = useCallback(async () => {
    await window.electronAPI?.installUpdate?.();
  }, []);

  const reset = useCallback(() => setStatus({ status: 'idle' }), []);

  return (
    <UpdaterContext.Provider
      value={{
        status,
        availabilityEventId,
        checkForUpdate,
        downloadUpdate,
        cancelUpdate,
        installUpdate,
        reset,
      }}
    >
      {children}
    </UpdaterContext.Provider>
  );
}

export const useUpdater = () => useContext(UpdaterContext);
