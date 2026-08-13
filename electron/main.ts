import { writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IpcMainInvokeEvent } from 'electron';
import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron';
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
let splashWindow: BrowserWindow | null = null;

const iconPath = app.isPackaged
  ? join(process.resourcesPath, 'icon.ico')
  : join(__dirname, '..', 'build', 'icon.ico');

function createSplashWindow(): Promise<void> {
  return new Promise((resolve) => {
    splashWindow = new BrowserWindow({
      icon: iconPath,
      width: 480,
      height: 360,
      useContentSize: true,
      frame: false,
      hasShadow: false,
      transparent: false,
      backgroundColor: '#1a1a2e',
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    const splashPath = app.isPackaged
      ? join(process.resourcesPath, 'splash.html')
      : join(__dirname, '..', 'build', 'splash.html');
    splashWindow.loadFile(splashPath);
    splashWindow.once('ready-to-show', () => {
      splashWindow?.show();
      splashWindow?.center();
      resolve();
    });
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    icon: iconPath,
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
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

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow?.show();
  });

  // Restrict navigation to app's own URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedOrigins = ['http://localhost:', `file://${__dirname}`];
    const isAllowed = allowedOrigins.some((origin) => url.startsWith(origin));
    if (!isAllowed) {
      event.preventDefault();
    }
  });

  // Restrict new window creation: open external links in default browser, block others
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
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

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const isDev = !!process.env.VITE_DEV_SERVER_URL;

function assertTrustedIpcSender(event: IpcMainInvokeEvent): void {
  if (
    !mainWindow ||
    event.sender !== mainWindow.webContents ||
    event.senderFrame !== mainWindow.webContents.mainFrame
  ) {
    throw new Error('Rejected IPC request from an untrusted renderer');
  }
}

app.on('ready', async () => {
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
    (_webContents, _permission, callback) => {
      callback(false);
    },
  );

  session.defaultSession.setPermissionCheckHandler(() => false);

  await createSplashWindow();
  createWindow();

  initAutoUpdater();

  ipcMain.handle('update:check', async (event) => {
    assertTrustedIpcSender(event);
    try {
      const status = await checkForUpdate();
      return { success: true, data: status, error: null };
    } catch (err) {
      return { success: false, data: null, error: (err as Error).message };
    }
  });

  ipcMain.handle('update:download', async (event) => {
    assertTrustedIpcSender(event);
    try {
      await downloadUpdate();
      return { success: true, data: null, error: null };
    } catch (err) {
      return { success: false, data: null, error: (err as Error).message };
    }
  });

  ipcMain.handle('update:cancel', (event) => {
    assertTrustedIpcSender(event);
    const cancelled = cancelDownload();
    return {
      success: cancelled,
      data: null,
      error: cancelled ? null : 'No download in progress',
    };
  });

  ipcMain.handle('update:install', (event) => {
    assertTrustedIpcSender(event);
    installUpdate();
  });

  ipcMain.handle('update:status', (event) => {
    assertTrustedIpcSender(event);
    return getUpdateStatus();
  });

  ipcMain.handle('update:set-auto-check', (event, enabled: unknown) => {
    assertTrustedIpcSender(event);
    if (typeof enabled !== 'boolean') return;
    if (enabled) {
      startAutoCheckSchedule();
    } else {
      stopAutoCheckSchedule();
    }
  });

  ipcMain.handle('update:get-version', (event) => {
    assertTrustedIpcSender(event);
    return app.getVersion();
  });

  ipcMain.handle('update:get-current-changelog', async (event) => {
    assertTrustedIpcSender(event);
    const version = app.getVersion();
    const changelog = await fetchChangelog(version);
    return { version, changelog };
  });

  ipcMain.handle(
    'file:save',
    async (
      event,
      buffer: unknown,
      filename: unknown,
      mimeType: unknown,
    ): Promise<{ success: boolean; error?: string; path?: string }> => {
      assertTrustedIpcSender(event);
      if (!mainWindow) {
        return { success: false, error: 'Main window not available' };
      }

      if (!(buffer instanceof Uint8Array)) {
        return { success: false, error: 'Invalid buffer' };
      }

      if (typeof filename !== 'string' || !filename.trim()) {
        return { success: false, error: 'Invalid filename' };
      }

      if (mimeType !== 'application/json' && mimeType !== 'application/zip') {
        return { success: false, error: 'Unsupported file type' };
      }

      const safeFilename = basename(filename.trim()).slice(0, 255);

      const filters =
        mimeType === 'application/json'
          ? [{ name: 'JSON Backup', extensions: ['json'] }]
          : mimeType === 'application/zip'
            ? [{ name: 'ZIP Backup', extensions: ['zip'] }]
            : [];

      try {
        const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
          defaultPath: safeFilename,
          filters: [...filters, { name: 'All Files', extensions: ['*'] }],
        });

        if (canceled || !filePath) {
          return { success: false, error: 'User cancelled' };
        }

        await writeFile(filePath, Buffer.from(buffer));
        return { success: true, path: filePath };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );
});

// macOS: re-create window when dock icon clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
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
