import { mkdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron';
import { BACKUP_CHANNELS } from '../src/lib/backup/exportContract';
import { UPDATE_INVOKE_CHANNELS } from '../src/lib/updater/ipcContract';
import { BackupWriter } from './backupWriter';
import { isPromptableExternalUrl, isSafeExternalUrl } from './security';
import {
  cancelDownload,
  checkForUpdate,
  downloadUpdate,
  fetchChangelog,
  getUpdateStatus,
  initAutoUpdater,
  installUpdate,
  startAutoCheckSchedule,
  stopAutoCheckSchedule,
} from './updateManager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let rendererGeneration = 0;
const MAIN_WINDOW_LOAD_TIMEOUT_MS = 15_000;
const isDev = !!process.env.VITE_DEV_SERVER_URL;

// Chromium cannot safely share a profile between development and installed apps.
// Leave the installed profile in place; development has its own library and cache.
if (isDev) {
  const developmentProfile = `${app.getPath('userData')}-development`;
  mkdirSync(developmentProfile, { recursive: true });
  app.setPath('userData', developmentProfile);
  app.setPath('sessionData', developmentProfile);
  app.commandLine.appendSwitch('disable-http-cache');
}

const hasInstanceLock = app.requestSingleInstanceLock();
const backupWriter = new BackupWriter(
  join(app.getPath('userData'), 'backup-transfers'),
);
if (!hasInstanceLock) app.quit();

app.on('second-instance', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

const iconPath = app.isPackaged
  ? join(process.resourcesPath, 'icon.ico')
  : join(__dirname, '..', 'build', 'icon.ico');

async function loadWindowContent(
  window: BrowserWindow,
  load: () => Promise<void>,
  timeoutMs: number,
): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const readyToShow = new Promise<void>((resolve) => {
    window.once('ready-to-show', resolve);
  });
  const timedOut = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`Window did not become ready within ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    await Promise.race([
      Promise.all([Promise.resolve().then(load), readyToShow]),
      timedOut,
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function createWindow(): Promise<boolean> {
  const window = new BrowserWindow({
    icon: iconPath,
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#080b15',
    webPreferences: {
      preload: join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
      spellcheck: false,
    },
    show: false,
    autoHideMenuBar: true,
  });
  mainWindow = window;
  rendererGeneration++;
  window.webContents.on(
    'did-start-navigation',
    (_event, _url, isInPlace, isMainFrame) => {
      if (isMainFrame && !isInPlace) {
        rendererGeneration++;
        void backupWriter.abort().catch(console.error);
      }
    },
  );

  // Restrict navigation to app's own URLs
  window.webContents.on('will-navigate', (event, url) => {
    const allowedOrigins = ['http://localhost:', `file://${__dirname}`];
    const isAllowed = allowedOrigins.some((origin) => url.startsWith(origin));
    if (!isAllowed) {
      event.preventDefault();
    }
  });

  // Restrict new window creation: open external links in default browser, block others
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
      return { action: 'deny' };
    }

    if (isPromptableExternalUrl(url)) {
      const currentWindow = mainWindow;
      if (currentWindow && !currentWindow.isDestroyed()) {
        let hostname = 'this site';
        try {
          hostname = new URL(url).hostname;
        } catch {
          // Keep fallback label for malformed URLs.
        }

        void dialog
          .showMessageBox(currentWindow, {
            type: 'question',
            buttons: ['Open Link', 'Cancel'],
            defaultId: 1,
            cancelId: 1,
            noLink: true,
            title: 'Open External Link?',
            message: `Open external link to ${hostname}?`,
            detail: url,
          })
          .then(({ response }) => {
            if (response === 0) {
              void shell.openExternal(url);
            }
          })
          .catch(() => {
            // Swallow dialog errors and keep navigation blocked.
          });
      }
    }

    return { action: 'deny' };
  });

  window.on('closed', () => {
    rendererGeneration++;
    void backupWriter.abort().catch(console.error);
    if (mainWindow === window) {
      mainWindow = null;
    }
  });
  window.webContents.on('render-process-gone', () => {
    rendererGeneration++;
    void backupWriter.abort().catch(console.error);
  });

  try {
    await loadWindowContent(
      window,
      () =>
        process.env.VITE_DEV_SERVER_URL
          ? window.loadURL(process.env.VITE_DEV_SERVER_URL)
          : window.loadFile(join(__dirname, '../dist/index.html')),
      MAIN_WINDOW_LOAD_TIMEOUT_MS,
    );
    if (!window.isDestroyed()) {
      window.show();
    }
    return true;
  } catch (error) {
    console.error('Unable to load the main application window.', error);
    if (!window.isDestroyed()) {
      window.close();
    }
    if (mainWindow === window) {
      mainWindow = null;
    }

    try {
      await dialog.showMessageBox({
        type: 'error',
        buttons: ['Quit'],
        defaultId: 0,
        title: 'Notation Labs could not start',
        message: 'The application interface could not be loaded.',
        detail:
          error instanceof Error
            ? error.message
            : 'An unknown window loading error occurred.',
      });
    } catch (dialogError) {
      console.error('Unable to display the startup error dialog.', dialogError);
    } finally {
      app.quit();
    }

    return false;
  }
}

function assertTrustedIpcSender(event: IpcMainInvokeEvent): void {
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    event.sender !== mainWindow.webContents ||
    event.sender.isDestroyed() ||
    event.senderFrame !== mainWindow.webContents.mainFrame
  ) {
    throw new Error('Rejected IPC request from an untrusted renderer');
  }
}

function canWriteClipboard(
  contents: WebContents | null,
  permission: string,
  details: { isMainFrame: boolean; requestingUrl?: string },
): boolean {
  if (
    permission !== 'clipboard-sanitized-write' ||
    !mainWindow ||
    mainWindow.isDestroyed() ||
    !contents ||
    contents !== mainWindow.webContents ||
    contents.isDestroyed() ||
    !details.isMainFrame
  )
    return false;
  try {
    const rendererUrl =
      process.env.VITE_DEV_SERVER_URL ??
      pathToFileURL(join(__dirname, '../dist/index.html')).href;
    return (
      new URL(details.requestingUrl ?? '').href === new URL(rendererUrl).href
    );
  } catch {
    return false;
  }
}

app.on('ready', async () => {
  if (!hasInstanceLock) return;
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // Only apply our CSP to the app's own pages, not to external resources
    // (applying frame-ancestors 'none' to YouTube's response would block the embed)
    const isAppContent =
      details.url.startsWith('file://') ||
      details.url.startsWith('http://localhost:');

    if (!isAppContent) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'self'",
            isDev ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob: https://images.igdb.com/ https://i.ytimg.com/ https://tse1.mm.bing.net/ https://tse2.mm.bing.net/ https://tse3.mm.bing.net/ https://tse4.mm.bing.net/ https://www.google.com/ https://t0.gstatic.com/ https://t1.gstatic.com/ https://t2.gstatic.com/ https://t3.gstatic.com/",
            "media-src 'self' blob:",
            'frame-src https://www.youtube-nocookie.com',
            isDev
              ? "connect-src 'self' ws://localhost:* https://noembed.com https://images.igdb.com/ https://ddg.capitol-k.workers.dev/ https://igdb.capitol-k.workers.dev/"
              : "connect-src 'self' https://noembed.com https://images.igdb.com/ https://ddg.capitol-k.workers.dev/ https://igdb.capitol-k.workers.dev/",
            "worker-src 'self' blob:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
          ].join('; '),
        ],
      },
    });
  });

  session.defaultSession.setPermissionRequestHandler(
    (contents, permission, callback, details) => {
      callback(canWriteClipboard(contents, permission, details));
    },
  );

  session.defaultSession.setPermissionCheckHandler(
    (contents, permission, _origin, details) =>
      canWriteClipboard(contents, permission, details),
  );

  await backupWriter.recover().catch(console.error);
  const mainWindowReady = createWindow();

  initAutoUpdater();

  ipcMain.handle(UPDATE_INVOKE_CHANNELS.check, async (event) => {
    assertTrustedIpcSender(event);
    try {
      const status = await checkForUpdate();
      return { success: true, data: status, error: null };
    } catch (err) {
      return { success: false, data: null, error: (err as Error).message };
    }
  });

  ipcMain.handle(UPDATE_INVOKE_CHANNELS.download, async (event) => {
    assertTrustedIpcSender(event);
    try {
      await downloadUpdate();
      return { success: true, data: null, error: null };
    } catch (err) {
      return { success: false, data: null, error: (err as Error).message };
    }
  });

  ipcMain.handle(UPDATE_INVOKE_CHANNELS.cancel, (event) => {
    assertTrustedIpcSender(event);
    const cancelled = cancelDownload();
    return {
      success: cancelled,
      data: null,
      error: cancelled ? null : 'No download in progress',
    };
  });

  ipcMain.handle(UPDATE_INVOKE_CHANNELS.install, (event) => {
    assertTrustedIpcSender(event);
    installUpdate();
  });

  ipcMain.handle(UPDATE_INVOKE_CHANNELS.status, (event) => {
    assertTrustedIpcSender(event);
    return getUpdateStatus();
  });

  ipcMain.handle(
    UPDATE_INVOKE_CHANNELS.setAutoCheck,
    (event, enabled: unknown) => {
      assertTrustedIpcSender(event);
      if (typeof enabled !== 'boolean') return;
      if (enabled) {
        startAutoCheckSchedule();
      } else {
        stopAutoCheckSchedule();
      }
    },
  );

  ipcMain.handle(UPDATE_INVOKE_CHANNELS.getVersion, (event) => {
    assertTrustedIpcSender(event);
    return app.getVersion();
  });

  ipcMain.handle(UPDATE_INVOKE_CHANNELS.getCurrentChangelog, async (event) => {
    assertTrustedIpcSender(event);
    const version = app.getVersion();
    const changelog = await fetchChangelog(version);
    return { version, changelog };
  });

  ipcMain.handle(
    BACKUP_CHANNELS.begin,
    async (event, filename: unknown, mimeType: unknown) => {
      assertTrustedIpcSender(event);
      if (!mainWindow) throw new Error('Main window not available');
      if (typeof filename !== 'string' || !filename.trim())
        throw new Error('Invalid filename');
      if (mimeType !== 'application/zip' && mimeType !== 'application/json')
        throw new Error('Unsupported file type');
      const generation = rendererGeneration;
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        defaultPath: basename(filename.trim()).slice(0, 255),
        filters: [
          {
            name: 'Notation Labs Backup',
            extensions: [mimeType === 'application/zip' ? 'zip' : 'json'],
          },
        ],
      });
      if (canceled || !filePath) return null;
      assertTrustedIpcSender(event);
      if (generation !== rendererGeneration)
        throw new Error(
          'Export cancelled because the application page changed',
        );
      return backupWriter.begin(filePath);
    },
  );
  ipcMain.handle(
    BACKUP_CHANNELS.write,
    async (event, id: unknown, chunk: unknown) => {
      assertTrustedIpcSender(event);
      await backupWriter.write(id, chunk);
    },
  );
  ipcMain.handle(BACKUP_CHANNELS.finish, async (event, id: unknown) => {
    assertTrustedIpcSender(event);
    await backupWriter.finish(id);
  });
  ipcMain.handle(BACKUP_CHANNELS.capacity, (event, id: unknown) => {
    assertTrustedIpcSender(event);
    return backupWriter.availableBytes(id);
  });
  ipcMain.handle(BACKUP_CHANNELS.abort, async (event, id: unknown) => {
    assertTrustedIpcSender(event);
    if (typeof id !== 'string') throw new Error('Invalid backup session');
    await backupWriter.abort(id);
  });

  await mainWindowReady;
});

// macOS: re-create window when dock icon clicked
app.on('activate', () => {
  if (hasInstanceLock && BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});
