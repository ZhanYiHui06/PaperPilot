import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';

// Window control IPC handlers.
// Uses ipcMain.on (fire-and-forget) for minimize/maximize/close,
// and ipcMain.handle for querying maximized state.
// Also broadcasts maximize/unmaximize events so the renderer can
// toggle its icon without polling.
const MAXIMIZE_EVENT = 'window:maximized';
const UNMAXIMIZE_EVENT = 'window:unmaximized';

export function registerWindowIpc(): void {
  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize();
  });

  ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE, (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });

  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, (e): boolean => {
    return BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false;
  });
}

// Attach maximize/unmaximize event listeners to a window so the renderer
// receives state changes without polling. Call this right after creating
// the BrowserWindow.
export function attachWindowEvents(win: BrowserWindow): void {
  win.on('maximize', () => {
    win.webContents.send(MAXIMIZE_EVENT);
  });
  win.on('unmaximize', () => {
    win.webContents.send(UNMAXIMIZE_EVENT);
  });
}

export { MAXIMIZE_EVENT, UNMAXIMIZE_EVENT };
