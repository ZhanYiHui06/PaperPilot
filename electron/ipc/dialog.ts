import { ipcMain, dialog, BrowserWindow } from 'electron';
import { writeFileSync } from 'fs';
import { IPC_CHANNELS } from '../../shared/types';

export function registerDialogIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.DIALOG_SAVE_FILE,
    async (
      _e,
      defaultName: string,
      filters?: Array<{ name: string; extensions: string[] }>,
    ): Promise<string | null> => {
      const win = BrowserWindow.getFocusedWindow();
      const options = {
        defaultPath: defaultName,
        filters: filters ?? [
          { name: 'JSON', extensions: ['json'] },
          { name: 'Markdown', extensions: ['md'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      };
      // Attach to focused window when available; otherwise fall back to a
      // windowless dialog (passing `undefined` is supported by Electron and
      // avoids leaking an empty BrowserWindow instance).
      const result = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options);
      return result.canceled ? null : result.filePath;
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.DIALOG_OPEN_DIRECTORY,
    async (): Promise<string | null> => {
      const win = BrowserWindow.getFocusedWindow();
      const options = { properties: ['openDirectory' as const] };
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);
      return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
    },
  );

  // Writes text content to an absolute file path chosen by the user via
  // DIALOG_SAVE_FILE. The renderer process cannot touch the filesystem
  // directly, so this IPC channel is the only way to persist exports to disk.
  ipcMain.handle(
    IPC_CHANNELS.DIALOG_WRITE_FILE,
    async (_e, filePath: string, content: string): Promise<void> => {
      writeFileSync(filePath, content, 'utf-8');
    },
  );
}
