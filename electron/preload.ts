import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { IPC_CHANNELS } from '../shared/types';
import type {
  Project,
  CreateProjectInput,
  ProgressNode,
  CreateProgressNodeInput,
  CodeVersion,
  Experiment,
  LatexVersion,
  Email,
  EmailType,
  LLMConfig,
  EmailConfig,
  GitConfig,
  AppConfig,
  GitStatus,
  GitCommit,
  EmailTestResult,
  LLMTestResult,
  LLMClassifyEmailResult,
  ParsedExperimentData,
  LatexCompileResult,
  LatexEngineStatus,
  LatexEngineProgress,
  LatexEngineInfo,
  LatexEngineType,
  LatexFileNode,
} from '../shared/types';

const api = {
  db: {
    projects: {
      list: (): Promise<Project[]> => ipcRenderer.invoke(IPC_CHANNELS.DB_PROJECTS_LIST),
      get: (id: string): Promise<Project | null> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_PROJECTS_GET, id),
      create: (input: CreateProjectInput): Promise<Project> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_PROJECTS_CREATE, input),
      update: (id: string, input: Partial<Project>): Promise<Project> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_PROJECTS_UPDATE, id, input),
      delete: (id: string): Promise<void> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_PROJECTS_DELETE, id),
      archive: (id: string): Promise<void> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_PROJECTS_ARCHIVE, id),
      listArchived: (): Promise<Project[]> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_PROJECTS_LIST_ARCHIVED),
      restore: (id: string): Promise<void> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_PROJECTS_RESTORE, id),
    },
    progressNodes: {
      list: (projectId: string): Promise<ProgressNode[]> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_PROGRESS_NODES_LIST, projectId),
      create: (input: CreateProgressNodeInput): Promise<ProgressNode> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_PROGRESS_NODES_CREATE, input),
      update: (id: string, input: Partial<ProgressNode>): Promise<ProgressNode> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_PROGRESS_NODES_UPDATE, id, input),
      delete: (id: string): Promise<void> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_PROGRESS_NODES_DELETE, id),
    },
    codeVersions: {
      list: (projectId: string): Promise<CodeVersion[]> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_CODE_VERSIONS_LIST, projectId),
      create: (input: Partial<CodeVersion>): Promise<CodeVersion> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_CODE_VERSIONS_CREATE, input),
      update: (id: string, input: Partial<CodeVersion>): Promise<CodeVersion> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_CODE_VERSIONS_UPDATE, id, input),
      delete: (id: string): Promise<void> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_CODE_VERSIONS_DELETE, id),
    },
    experiments: {
      list: (projectId: string): Promise<Experiment[]> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_EXPERIMENTS_LIST, projectId),
      create: (input: Partial<Experiment>): Promise<Experiment> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_EXPERIMENTS_CREATE, input),
      update: (id: string, input: Partial<Experiment>): Promise<Experiment> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_EXPERIMENTS_UPDATE, id, input),
    },
    latexVersions: {
      list: (projectId: string): Promise<LatexVersion[]> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_LATEX_VERSIONS_LIST, projectId),
      create: (input: Partial<LatexVersion>): Promise<LatexVersion> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_LATEX_VERSIONS_CREATE, input),
    },
    emails: {
      list: (projectId: string): Promise<Email[]> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_EMAILS_LIST, projectId),
      create: (input: Partial<Email>): Promise<Email> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_EMAILS_CREATE, input),
      update: (id: string, input: Partial<Email>): Promise<Email> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_EMAILS_UPDATE, id, input),
    },
    llmConfig: {
      get: (): Promise<LLMConfig | null> => ipcRenderer.invoke(IPC_CHANNELS.DB_LLM_CONFIG_GET),
      update: (config: LLMConfig): Promise<void> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_LLM_CONFIG_UPDATE, config),
    },
    emailConfig: {
      get: (): Promise<EmailConfig | null> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_EMAIL_CONFIG_GET),
      save: (config: EmailConfig): Promise<void> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_EMAIL_CONFIG_SAVE, config),
      delete: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.DB_EMAIL_CONFIG_DELETE),
    },
    gitConfig: {
      get: (): Promise<GitConfig | null> => ipcRenderer.invoke(IPC_CHANNELS.DB_GIT_CONFIG_GET),
      save: (config: GitConfig): Promise<void> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_GIT_CONFIG_SAVE, config),
    },
    appConfig: {
      get: (): Promise<AppConfig | null> => ipcRenderer.invoke(IPC_CHANNELS.DB_APP_CONFIG_GET),
      save: (config: AppConfig): Promise<void> =>
        ipcRenderer.invoke(IPC_CHANNELS.DB_APP_CONFIG_SAVE, config),
    },
  },
  git: {
    getStatus: (repoPath: string): Promise<GitStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_GET_STATUS, repoPath),
    getDiff: (repoPath: string, from?: string, to?: string): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_GET_DIFF, repoPath, from, to),
    getCommits: (repoPath: string, limit?: number): Promise<GitCommit[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_GET_COMMITS, repoPath, limit),
  },
  email: {
    connect: (config: EmailConfig): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.EMAIL_CONNECT, config),
    fetch: (projectId: string): Promise<Email[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.EMAIL_FETCH, projectId),
    classify: (emailId: string): Promise<EmailType> =>
      ipcRenderer.invoke(IPC_CHANNELS.EMAIL_CLASSIFY, emailId),
    testConnection: (config: EmailConfig): Promise<EmailTestResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.EMAIL_TEST_CONNECTION, config),
    // Subscribe to individual emails as they are fetched (streaming).
    onEmailFetched: (cb: (email: Email) => void): (() => void) => {
      const handler = (_e: unknown, data: Email): void => cb(data);
      ipcRenderer.on('email:fetched', handler);
      return () => {
        ipcRenderer.removeListener('email:fetched', handler);
      };
    },
  },
  llm: {
    summarize: (
      type: 'code' | 'experiment' | 'latex' | 'email' | 'latex_error',
      content: string,
    ): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.LLM_SUMMARIZE, type, content),
    classifyEmail: (content: string): Promise<LLMClassifyEmailResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.LLM_CLASSIFY_EMAIL, content),
    parseExperiment: (logContent: string): Promise<ParsedExperimentData> =>
      ipcRenderer.invoke(IPC_CHANNELS.LLM_PARSE_EXPERIMENT, logContent),
    testConnection: (): Promise<LLMTestResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.LLM_TEST_CONNECTION),
  },
  dialog: {
    saveFile: (defaultName: string, filters?: Array<{ name: string; extensions: string[] }>) =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SAVE_FILE, defaultName, filters),
    openDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY),
    writeFile: (filePath: string, content: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_WRITE_FILE, filePath, content),
  },
  latex: {
    getEngineStatus: (): Promise<LatexEngineStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.LATEX_GET_ENGINE_STATUS),
    ensureEngine: (): Promise<LatexEngineStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.LATEX_ENSURE_ENGINE),
    compile: (source: string): Promise<LatexCompileResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.LATEX_COMPILE, source),
    compileProject: (projectId: string, mainFile: string): Promise<LatexCompileResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.LATEX_COMPILE_PROJECT, projectId, mainFile),
    getEngineConfig: (): Promise<LatexEngineType> =>
      ipcRenderer.invoke(IPC_CHANNELS.LATEX_GET_ENGINE_CONFIG),
    setEngineConfig: (engine: LatexEngineType): Promise<LatexEngineType> =>
      ipcRenderer.invoke(IPC_CHANNELS.LATEX_SET_ENGINE_CONFIG, engine),
    detectSystemEngines: (): Promise<LatexEngineInfo[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.LATEX_DETECT_SYSTEM_ENGINES),
    // Subscribe to engine setup progress events. Returns an unsubscribe fn.
    onEngineProgress: (cb: (p: LatexEngineProgress) => void): (() => void) => {
      const handler = (_e: unknown, data: LatexEngineProgress): void => cb(data);
      ipcRenderer.on('latex:engine-progress', handler);
      return () => {
        ipcRenderer.removeListener('latex:engine-progress', handler);
      };
    },
    // Subscribe to compile log chunks streamed during compilation.
    onCompileLog: (cb: (entry: { stream: 'stdout' | 'stderr'; text: string }) => void): (() => void) => {
      const handler = (_e: unknown, data: { stream: 'stdout' | 'stderr'; text: string }): void =>
        cb(data);
      ipcRenderer.on('latex:compile-log', handler);
      return () => {
        ipcRenderer.removeListener('latex:compile-log', handler);
      };
    },
    // --- File management ---
    getStoragePath: (): Promise<{ path: string; isCustom: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.LATEX_GET_STORAGE_PATH),
    setStoragePath: (path: string | null): Promise<{ path: string; isCustom: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.LATEX_SET_STORAGE_PATH, path),
    importZip: (projectId: string, zipPath: string): Promise<{ files: LatexFileNode[]; mainFile: string | null }> =>
      ipcRenderer.invoke(IPC_CHANNELS.LATEX_IMPORT_ZIP, projectId, zipPath),
    listFiles: (projectId: string): Promise<{ files: LatexFileNode[]; mainFile: string | null }> =>
      ipcRenderer.invoke(IPC_CHANNELS.LATEX_LIST_FILES, projectId),
    readFile: (projectId: string, filePath: string): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.LATEX_READ_FILE, projectId, filePath),
    readBinaryFile: (projectId: string, filePath: string): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.LATEX_READ_BINARY_FILE, projectId, filePath),
    writeFile: (projectId: string, filePath: string, content: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.LATEX_WRITE_FILE, projectId, filePath, content),
    deleteFile: (projectId: string, filePath: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.LATEX_DELETE_FILE, projectId, filePath),
    createFile: (projectId: string, filePath: string, isDirectory: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.LATEX_CREATE_FILE, projectId, filePath, isDirectory),
    renameFile: (projectId: string, oldPath: string, newPath: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.LATEX_RENAME_FILE, projectId, oldPath, newPath),
    getMainFile: (projectId: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.LATEX_GET_MAIN_FILE, projectId),
    setMainFile: (projectId: string, filePath: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.LATEX_SET_MAIN_FILE, projectId, filePath),
    // Get the filesystem path of a dropped File object (Electron drag-and-drop).
    getFilePath: (file: File): string => webUtils.getPathForFile(file),
  },
  window: {
    minimize: (): void => {
      ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE);
    },
    maximize: (): void => {
      ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE);
    },
    close: (): void => {
      ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE);
    },
    isMaximized: (): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED),
    // Subscribe to maximize/unmaximize state changes. Returns an unsubscribe fn.
    onMaximizeChange: (cb: (maximized: boolean) => void): (() => void) => {
      const maxHandler = (): void => cb(true);
      const unmaxHandler = (): void => cb(false);
      ipcRenderer.on('window:maximized', maxHandler);
      ipcRenderer.on('window:unmaximized', unmaxHandler);
      return () => {
        ipcRenderer.removeListener('window:maximized', maxHandler);
        ipcRenderer.removeListener('window:unmaximized', unmaxHandler);
      };
    },
  },
};

export type PaperPilotAPI = typeof api;

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error('Failed to expose API to renderer:', error);
  }
} else {
  // @ts-ignore reason: fallback for non-context-isolated mode
  window.api = api;
}
