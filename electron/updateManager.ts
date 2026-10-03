import { app, BrowserWindow, net, shell } from 'electron';
import {
  autoUpdater,
  CancellationToken,
  type ProgressInfo,
  type UpdateInfo,
} from 'electron-updater';
import { valid } from 'semver';
import {
  INITIAL_UPDATE_STATUS,
  UPDATE_EVENT_CHANNELS,
  type UpdateState,
  type UpdateStatus,
} from '../src/lib/updater/ipcContract';
import { isSafeExternalUrl } from './security';
import { isUpdateEligible } from './updatePolicy';

const RELEASES_URL =
  'https://api.github.com/repos/kevinkickback/notation.LABS/releases';
const RELEASE_HEADERS = {
  Accept: 'application/vnd.github.v3+json',
  'User-Agent': 'notation-labs-updater',
};
const AUTO_CHECK_INTERVAL = 24 * 60 * 60 * 1000;
const STARTUP_CHECK_DELAY = 3000;
let currentStatus: UpdateStatus = INITIAL_UPDATE_STATUS;
let cancellationToken: CancellationToken | null = null;
let checkPromise: Promise<UpdateStatus> | null = null;
let downloadPromise: Promise<void> | null = null;
let metadataRequest = 0;
let autoCheckTimer: ReturnType<typeof setInterval> | null = null;
let startupCheckTimeout: ReturnType<typeof setTimeout> | null = null;
let devSimInterval: ReturnType<typeof setInterval> | null = null;
let isPortableMode = false;
let initialized = false;

function publish(state: UpdateState): UpdateStatus {
  const announcesUpdate =
    state.status === 'available' &&
    (currentStatus.status === 'checking' ||
      state.update.version !== currentStatus.update?.version);
  currentStatus = {
    ...state,
    revision: currentStatus.revision + 1,
    availabilityEventId:
      currentStatus.availabilityEventId + (announcesUpdate ? 1 : 0),
  };
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed())
    win.webContents.send(UPDATE_EVENT_CHANNELS.status, currentStatus);
  return currentStatus;
}

function publishError(error: unknown): UpdateStatus {
  const message =
    error instanceof Error
      ? error.message
      : 'Could not complete the update request.';
  if (currentStatus.status === 'error' && currentStatus.error === message)
    return currentStatus;
  return publish({
    status: 'error',
    update: currentStatus.update,
    error: message,
  });
}

function releaseBody(data: unknown): string | null {
  return data &&
    typeof data === 'object' &&
    'body' in data &&
    typeof data.body === 'string'
    ? data.body
    : null;
}

export async function fetchChangelog(version: string): Promise<string | null> {
  try {
    const response = await net.fetch(`${RELEASES_URL}/tags/v${version}`, {
      headers: RELEASE_HEADERS,
    });
    return response.ok ? releaseBody(await response.json()) : null;
  } catch {
    return null;
  }
}

function announceUpdate(version: string) {
  const request = ++metadataRequest;
  publish({
    status: 'available',
    update: {
      status: 'available',
      version,
      changelog: null,
      changelogLoading: true,
      isPortable: isPortableMode,
    },
  });
  void fetchChangelog(version).then((changelog) => {
    // Notes enrich the same update without moving its download/check state backwards.
    if (
      currentStatus.status === 'idle' ||
      currentStatus.status === 'not-available'
    )
      return;
    if (
      request !== metadataRequest ||
      currentStatus.update?.version !== version
    )
      return;
    publish({
      ...currentStatus,
      update: { ...currentStatus.update, changelog, changelogLoading: false },
    });
  });
}

function isDownloadingOrReady() {
  return (
    currentStatus.status === 'downloading' ||
    currentStatus.status === 'downloaded'
  );
}

export function initAutoUpdater() {
  if (initialized) return;
  initialized = true;
  isPortableMode = !!process.env.PORTABLE_EXECUTABLE_DIR;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;
  if (!app.isPackaged) autoUpdater.forceDevUpdateConfig = true;
  autoUpdater.on('checking-for-update', () => {
    if (!isDownloadingOrReady())
      publish({ status: 'checking', update: currentStatus.update });
  });
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    if (
      !isDownloadingOrReady() &&
      isUpdateEligible(info.version, app.getVersion())
    )
      announceUpdate(info.version);
  });
  autoUpdater.on('update-not-available', () => {
    if (!isDownloadingOrReady()) {
      metadataRequest++;
      publish({ status: 'not-available', update: null });
    }
  });
  autoUpdater.on('error', (error: Error & { code?: string }) => {
    if (error.code === 'ERR_UPDATER_CANCELLED') return;
    publishError(error);
  });
  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    if (currentStatus.status !== 'downloading') return;
    publish({
      status: 'downloading',
      update: currentStatus.update,
      progress: {
        percentage: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        total: progress.total,
        transferred: progress.transferred,
      },
    });
  });
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    if (
      currentStatus.status !== 'downloading' ||
      currentStatus.update.version !== info.version
    )
      return;
    publish({
      status: 'downloaded',
      update: { ...currentStatus.update, status: 'downloaded' },
    });
  });
}

async function performCheck(): Promise<UpdateStatus> {
  if (!app.isPackaged)
    return publish({ status: 'not-available', update: null });
  publish({ status: 'checking', update: currentStatus.update });
  try {
    if (isPortableMode) {
      const response = await net.fetch(`${RELEASES_URL}/latest`, {
        headers: RELEASE_HEADERS,
      });
      if (!response.ok)
        throw new Error(
          `Could not check for updates (HTTP ${response.status}).`,
        );
      const data: unknown = await response.json();
      if (
        !data ||
        typeof data !== 'object' ||
        !('tag_name' in data) ||
        typeof data.tag_name !== 'string'
      ) {
        throw new Error('Invalid update information received.');
      }
      const version = data.tag_name.replace(/^v/, '');
      if (!valid(version)) throw new Error('Invalid update version received.');
      if (isUpdateEligible(version, app.getVersion())) {
        return publish({
          status: 'available',
          update: {
            status: 'available',
            version,
            changelog: releaseBody(data),
            changelogLoading: false,
            isPortable: true,
          },
        });
      }
      metadataRequest++;
      return publish({ status: 'not-available', update: null });
    }
    const result = await autoUpdater.checkForUpdates();
    // Events may already have advanced the state while the command was awaiting.
    if (currentStatus.status === 'checking') {
      const version = result?.updateInfo?.version;
      if (version && isUpdateEligible(version, app.getVersion()))
        announceUpdate(version);
      else {
        metadataRequest++;
        publish({ status: 'not-available', update: null });
      }
    }
    return currentStatus;
  } catch (error) {
    if (isDownloadingOrReady()) return currentStatus;
    return publishError(error);
  }
}

export function checkForUpdate(): Promise<UpdateStatus> {
  if (isDownloadingOrReady()) return Promise.resolve(currentStatus);
  if (!checkPromise)
    checkPromise = performCheck().finally(() => {
      checkPromise = null;
    });
  return checkPromise;
}

export function downloadUpdate(): Promise<void> {
  if (downloadPromise) {
    // electron-updater caches its request until cancellation has finished.
    return cancellationToken?.cancelled || currentStatus.status === 'cancelled'
      ? downloadPromise.then(() => downloadUpdate())
      : downloadPromise;
  }
  downloadPromise = performDownload()
    .catch((error) => {
      publishError(error);
      throw error;
    })
    .finally(() => {
      downloadPromise = null;
    });
  return downloadPromise;
}

async function performDownload(): Promise<void> {
  if (checkPromise) await checkPromise;
  if (
    currentStatus.status === 'downloaded' ||
    cancellationToken ||
    devSimInterval
  )
    return;
  if (isPortableMode) {
    const version = currentStatus.update?.version;
    const tag = version ? `tag/v${version}` : 'latest';
    const url = `https://github.com/kevinkickback/notation.LABS/releases/${tag}`;
    if (!isSafeExternalUrl(url)) throw new Error('Unsafe release URL blocked');
    await shell.openExternal(url);
    return;
  }
  const update =
    currentStatus.update ??
    (!app.isPackaged
      ? {
          status: 'available' as const,
          version: '99.0.0',
          changelog: null,
          changelogLoading: false,
          isPortable: false,
        }
      : null);
  if (!update) throw new Error('No update is available to download.');
  publish({ status: 'downloading', update });
  if (!app.isPackaged) {
    let percent = 0;
    devSimInterval = setInterval(() => {
      if (currentStatus.status !== 'downloading') return;
      percent += 20;
      publish({
        status: 'downloading',
        update: currentStatus.update,
        progress: {
          percentage: Math.min(percent, 100),
          bytesPerSecond: 2_500_000,
          total: 85_000_000,
          transferred: (Math.min(percent, 100) / 100) * 85_000_000,
        },
      });
      if (percent >= 100) {
        if (devSimInterval) clearInterval(devSimInterval);
        devSimInterval = null;
        publish({
          status: 'downloaded',
          update: { ...currentStatus.update, status: 'downloaded' },
        });
      }
    }, 800);
    return;
  }
  const token = new CancellationToken();
  cancellationToken = token;
  try {
    await autoUpdater.downloadUpdate(token);
  } catch (error) {
    if (token.cancelled || cancellationToken !== token) return;
    throw error;
  } finally {
    if (cancellationToken === token) cancellationToken = null;
  }
}

export function cancelDownload(): boolean {
  if (currentStatus.status !== 'downloading') return false;
  if (devSimInterval) {
    clearInterval(devSimInterval);
    devSimInterval = null;
  }
  cancellationToken?.cancel();
  publish({ status: 'cancelled', update: currentStatus.update });
  return true;
}

export function installUpdate(): void {
  if (!app.isPackaged || currentStatus.status !== 'downloaded') return;
  autoUpdater.quitAndInstall(true, true);
}

export function getUpdateStatus(): UpdateStatus {
  return currentStatus;
}

export function startAutoCheckSchedule() {
  if (startupCheckTimeout || autoCheckTimer) return;
  startupCheckTimeout = setTimeout(() => {
    startupCheckTimeout = null;
    void checkForUpdate();
  }, STARTUP_CHECK_DELAY);
  autoCheckTimer = setInterval(() => {
    void checkForUpdate();
  }, AUTO_CHECK_INTERVAL);
}

export function stopAutoCheckSchedule() {
  if (startupCheckTimeout) clearTimeout(startupCheckTimeout);
  if (autoCheckTimer) clearInterval(autoCheckTimer);
  startupCheckTimeout = null;
  autoCheckTimer = null;
}
