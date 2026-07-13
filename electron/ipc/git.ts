import { ipcMain } from 'electron';
import simpleGit from 'simple-git';
import { IPC_CHANNELS } from '../../shared/types';
import type { GitStatus, GitCommit } from '../../shared/types';

export function registerGitIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.GIT_GET_STATUS,
    async (_e, repoPath: string): Promise<GitStatus> => {
      const git = simpleGit(repoPath);
      const status = await git.status();
      return {
        modified: status.modified,
        deleted: status.deleted,
        created: status.not_added,
        ahead: status.ahead,
        behind: status.behind,
      };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_GET_DIFF,
    async (_e, repoPath: string, from?: string, to?: string): Promise<string> => {
      const git = simpleGit(repoPath);
      if (from && to) {
        return git.diff([`${from}..${to}`]);
      }
      if (from) {
        return git.diff([from]);
      }
      return git.diff();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_GET_COMMITS,
    async (_e, repoPath: string, limit = 50): Promise<GitCommit[]> => {
      const git = simpleGit(repoPath);
      const log = await git.log({ maxCount: limit });
      return log.all.map((entry) => ({
        hash: entry.hash,
        date: entry.date,
        message: entry.message,
        author: entry.author_name,
      }));
    },
  );
}
