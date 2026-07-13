import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import {
  listProjects,
  listArchivedProjects,
  restoreProject,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  archiveProject,
  listProgressNodes,
  createProgressNode,
  updateProgressNode,
  deleteProgressNode,
  listCodeVersions,
  createCodeVersion,
  updateCodeVersion,
  deleteCodeVersion,
  listExperiments,
  createExperiment,
  updateExperiment,
  listLatexVersions,
  createLatexVersion,
  listEmails,
  insertEmail,
  getEmailById,
  updateEmail,
  getLLMConfig,
  updateLLMConfig,
  getEmailConfig,
  saveEmailConfig,
  deleteEmailConfig,
  getGitConfig,
  saveGitConfig,
  getAppConfig,
  saveAppConfig,
} from '../../database/db';

export function registerDatabaseIpc(): void {
  // Projects
  ipcMain.handle(IPC_CHANNELS.DB_PROJECTS_LIST, async () => listProjects());
  ipcMain.handle(IPC_CHANNELS.DB_PROJECTS_GET, async (_e, id: string) => getProject(id));
  ipcMain.handle(IPC_CHANNELS.DB_PROJECTS_CREATE, async (_e, input) => createProject(input));
  ipcMain.handle(IPC_CHANNELS.DB_PROJECTS_UPDATE, async (_e, id: string, input) =>
    updateProject(id, input),
  );
  ipcMain.handle(IPC_CHANNELS.DB_PROJECTS_DELETE, async (_e, id: string) => deleteProject(id));
  ipcMain.handle(IPC_CHANNELS.DB_PROJECTS_ARCHIVE, async (_e, id: string) => archiveProject(id));
  ipcMain.handle(IPC_CHANNELS.DB_PROJECTS_LIST_ARCHIVED, async () => listArchivedProjects());
  ipcMain.handle(IPC_CHANNELS.DB_PROJECTS_RESTORE, async (_e, id: string) => restoreProject(id));

  // Progress Nodes
  ipcMain.handle(IPC_CHANNELS.DB_PROGRESS_NODES_LIST, async (_e, projectId: string) =>
    listProgressNodes(projectId),
  );
  ipcMain.handle(IPC_CHANNELS.DB_PROGRESS_NODES_CREATE, async (_e, input) =>
    createProgressNode(input),
  );
  ipcMain.handle(IPC_CHANNELS.DB_PROGRESS_NODES_UPDATE, async (_e, id: string, input) =>
    updateProgressNode(id, input),
  );
  ipcMain.handle(IPC_CHANNELS.DB_PROGRESS_NODES_DELETE, async (_e, id: string) =>
    deleteProgressNode(id),
  );

  // Code Versions
  ipcMain.handle(IPC_CHANNELS.DB_CODE_VERSIONS_LIST, async (_e, projectId: string) =>
    listCodeVersions(projectId),
  );
  ipcMain.handle(IPC_CHANNELS.DB_CODE_VERSIONS_CREATE, async (_e, input) => createCodeVersion(input));
  ipcMain.handle(IPC_CHANNELS.DB_CODE_VERSIONS_UPDATE, async (_e, id: string, input) =>
    updateCodeVersion(id, input),
  );
  ipcMain.handle(IPC_CHANNELS.DB_CODE_VERSIONS_DELETE, async (_e, id: string) =>
    deleteCodeVersion(id),
  );

  // Experiments
  ipcMain.handle(IPC_CHANNELS.DB_EXPERIMENTS_LIST, async (_e, projectId: string) =>
    listExperiments(projectId),
  );
  ipcMain.handle(IPC_CHANNELS.DB_EXPERIMENTS_CREATE, async (_e, input) => createExperiment(input));
  ipcMain.handle(IPC_CHANNELS.DB_EXPERIMENTS_UPDATE, async (_e, id: string, input) =>
    updateExperiment(id, input),
  );

  // LaTeX Versions
  ipcMain.handle(IPC_CHANNELS.DB_LATEX_VERSIONS_LIST, async (_e, projectId: string) =>
    listLatexVersions(projectId),
  );
  ipcMain.handle(IPC_CHANNELS.DB_LATEX_VERSIONS_CREATE, async (_e, input) => createLatexVersion(input));

  // Emails
  ipcMain.handle(IPC_CHANNELS.DB_EMAILS_LIST, async (_e, projectId: string) => listEmails(projectId));
  ipcMain.handle(IPC_CHANNELS.DB_EMAILS_CREATE, async (_e, input) => insertEmail(input));
  ipcMain.handle(IPC_CHANNELS.DB_EMAILS_UPDATE, async (_e, id: string, input) => updateEmail(id, input));

  // LLM Config
  ipcMain.handle(IPC_CHANNELS.DB_LLM_CONFIG_GET, async () => getLLMConfig());
  ipcMain.handle(IPC_CHANNELS.DB_LLM_CONFIG_UPDATE, async (_e, config) => updateLLMConfig(config));

  // Email Config
  ipcMain.handle(IPC_CHANNELS.DB_EMAIL_CONFIG_GET, async () => getEmailConfig());
  ipcMain.handle(IPC_CHANNELS.DB_EMAIL_CONFIG_SAVE, async (_e, config) => saveEmailConfig(config));
  ipcMain.handle(IPC_CHANNELS.DB_EMAIL_CONFIG_DELETE, async () => deleteEmailConfig());

  // Git Config
  ipcMain.handle(IPC_CHANNELS.DB_GIT_CONFIG_GET, async () => getGitConfig());
  ipcMain.handle(IPC_CHANNELS.DB_GIT_CONFIG_SAVE, async (_e, config) => saveGitConfig(config));

  // App Config
  ipcMain.handle(IPC_CHANNELS.DB_APP_CONFIG_GET, async () => getAppConfig());
  ipcMain.handle(IPC_CHANNELS.DB_APP_CONFIG_SAVE, async (_e, config) => saveAppConfig(config));
}
