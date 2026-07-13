import { app, BrowserWindow, shell, dialog } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { registerDatabaseIpc } from './ipc/db';
import { registerLlmIpc } from './ipc/llm';
import { registerGitIpc } from './ipc/git';
import { registerEmailIpc } from './ipc/email';
import { registerDialogIpc } from './ipc/dialog';
import { registerLatexIpc } from './ipc/latex';
import { registerLatexFileIpc } from './ipc/latex-files';
import { registerWindowIpc, attachWindowEvents } from './ipc/window';
import { initDatabase } from '../database/db';

// In dev mode, redirect userData to a local .data directory.
// The TRAE IDE sandbox blocks writes to %APPDATA%\paperpilot, which
// prevents Electron from creating GPU cache, Network cache, Local Storage, etc.
// This must be called before app.whenReady() so all paths use the new location.
if (process.env.ELECTRON_RENDERER_URL) {
  const localDataDir = join(process.cwd(), '.data', 'electron');
  if (!existsSync(localDataDir)) {
    mkdirSync(localDataDir, { recursive: true });
  }
  app.setPath('userData', localDataDir);
}

// Single instance lock — ensure only one PaperPilot instance runs at a time.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // If a second instance is launched, focus the existing window instead.
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      const win = windows[0];
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

function createWindow(): BrowserWindow {
  // 开发环境 __dirname 为 out/main，生产环境为 resources/app.asar/out/main
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../resources/icon.png');

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    title: 'PaperPilot',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Broadcast maximize/unmaximize events so the renderer can update its icon.
  attachWindowEvents(mainWindow);

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  // If the renderer fails to load, show the window anyway with an error message
  // so the user isn't stuck with an invisible process.
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('Renderer failed to load:', errorCode, errorDescription);
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

app.whenReady().then(() => {
  // Initialize database — if this fails, show an error dialog and quit.
  try {
    initDatabase();
  } catch (err) {
    dialog.showErrorBox(
      'PaperPilot 启动失败',
      `数据库初始化失败：\n${err instanceof Error ? err.message : String(err)}\n\n请重新安装应用或联系开发者。`,
    );
    app.quit();
    return;
  }

  // Register IPC handlers
  registerDatabaseIpc();
  registerLlmIpc();
  registerGitIpc();
  registerEmailIpc();
  registerDialogIpc();
  registerLatexIpc();
  registerLatexFileIpc();
  registerWindowIpc();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
