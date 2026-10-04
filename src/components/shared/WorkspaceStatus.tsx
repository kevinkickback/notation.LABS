import { useEffect, useState, useSyncExternalStore } from 'react';
import { useUpdater } from '@/context/UpdaterContext';
import { reportError } from '@/lib/errors';
import type { UpdateStatus } from '@/lib/updater/ipcContract';
import { NotificationHistory } from './NotificationHistory';

function updateLabel(
  update: UpdateStatus,
  displayedStatus = update.status,
): string | null {
  switch (displayedStatus) {
    case 'checking':
      return 'Checking for updates…';
    case 'not-available':
      return 'Up to date';
    case 'available':
      return update.update?.version
        ? `Update v${update.update?.version} available`
        : 'New update available';
    case 'downloading':
      return `Downloading update · ${Math.round(update.progress?.percentage ?? 0)}%`;
    case 'downloaded':
      return 'Update ready to install';
    case 'error':
      return 'Update error';
    case 'cancelled':
      return 'Update download cancelled';
    default:
      return null;
  }
}

function subscribeToConnection(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const isConnected = () => navigator.onLine;

export function WorkspaceStatus() {
  const { status, knownUpdate, showAvailableUpdate } = useUpdater();
  const [version, setVersion] = useState(__APP_VERSION__);
  const online = useSyncExternalStore(subscribeToConnection, isConnected);
  useEffect(() => {
    let active = true;
    void window.electronAPI
      ?.getAppVersion()
      .then((installedVersion) => {
        if (active) setVersion(installedVersion);
      })
      .catch((error) => reportError('WorkspaceStatus.getAppVersion', error));
    return () => {
      active = false;
    };
  }, []);
  const checkUnavailable =
    !online &&
    ['idle', 'checking', 'not-available', 'error'].includes(status.status);
  const displayedStatus =
    status.update?.status === 'downloaded'
      ? 'downloaded'
      : checkUnavailable && knownUpdate
        ? knownUpdate.status
        : status.status;
  const updateState =
    displayedStatus === 'not-available'
      ? 'current'
      : displayedStatus === 'error'
        ? 'error'
        : 'active';
  const offlineMessage = checkUnavailable && !knownUpdate;
  const updateMessage = offlineMessage
    ? 'Offline · updates unavailable'
    : updateLabel(status, displayedStatus);
  const detail =
    status.error ||
    (checkUnavailable
      ? 'Connect to the internet to check for updates'
      : undefined);

  return (
    <div className="workspace-status">
      <output className="workspace-status-message" aria-live="polite">
        <span className="workspace-version" title="App version">
          v{version}
        </span>
        {displayedStatus === 'available' || displayedStatus === 'downloaded' ? (
          <button
            type="button"
            onClick={() => showAvailableUpdate(status.update)}
            className="update-status"
            data-attention="true"
            data-state={updateState}
            title={detail}
          >
            {updateMessage}
          </button>
        ) : updateMessage ? (
          <span
            className="update-status"
            data-state={offlineMessage ? 'offline' : updateState}
            title={detail}
          >
            {updateMessage}
          </span>
        ) : null}
      </output>
      <NotificationHistory />
    </div>
  );
}
