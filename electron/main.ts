import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
import { isSafeExternalUrl } from './security';

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
      frame: false,
      transparent: false,
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
      shell.openExternal(url);
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
            "img-src 'self' data: blob: https://images.igdb.com/ https://i.ytimg.com/ https://tse1.mm.bing.net/ https://tse2.mm.bing.net/ https://tse3.mm.bing.net/ https://tse4.mm.bing.net/",
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

  ipcMain.handle('update:check', async () => {
    try {
      const status = await checkForUpdate();
      return { success: true, data: status, error: null };
    } catch (err) {
      return { success: false, data: null, error: (err as Error).message };
    }
  });

  ipcMain.handle('update:download', async () => {
    try {
      await downloadUpdate();
      return { success: true, data: null, error: null };
    } catch (err) {
      return { success: false, data: null, error: (err as Error).message };
    }
  });

  ipcMain.handle('update:cancel', () => {
    const cancelled = cancelDownload();
    return {
      success: cancelled,
      data: null,
      error: cancelled ? null : 'No download in progress',
    };
  });

  ipcMain.handle('update:install', () => {
    installUpdate();
  });

  ipcMain.handle('update:status', () => {
    return getUpdateStatus();
  });

  ipcMain.handle('update:set-auto-check', (_event, enabled: unknown) => {
    if (typeof enabled !== 'boolean') return;
    if (enabled) {
      startAutoCheckSchedule();
    } else {
      stopAutoCheckSchedule();
    }
  });

  ipcMain.handle('update:get-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('update:get-current-changelog', async () => {
    const version = app.getVersion();
    const changelog = await fetchChangelog(version);
    return { version, changelog };
  });
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
