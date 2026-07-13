// API type declarations for the renderer process
// This file declares the window.api interface that's exposed by the preload script

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
  LatexCompileResult,
  LatexEngineStatus,
  LatexEngineProgress,
  LatexEngineInfo,
  LatexEngineType,
  LatexFileNode,
} from '@shared/types';

interface PaperPilotAPI {
  db: {
    projects: {
      list: () => Promise<Project[]>;
      listArchived: () => Promise<Project[]>;
      get: (id: string) => Promise<Project | null>;
      create: (input: CreateProjectInput) => Promise<Project>;
      update: (id: string, input: Partial<Project>) => Promise<Project>;
      delete: (id: string) => Promise<void>;
      archive: (id: string) => Promise<void>;
      restore: (id: string) => Promise<void>;
    };
    progressNodes: {
      list: (projectId: string) => Promise<ProgressNode[]>;
      create: (input: CreateProgressNodeInput) => Promise<ProgressNode>;
      update: (id: string, input: Partial<ProgressNode>) => Promise<ProgressNode>;
      delete: (id: string) => Promise<void>;
    };
    codeVersions: {
      list: (projectId: string) => Promise<CodeVersion[]>;
      create: (input: Partial<CodeVersion>) => Promise<CodeVersion>;
      update: (id: string, input: Partial<CodeVersion>) => Promise<CodeVersion>;
      delete: (id: string) => Promise<void>;
    };
    experiments: {
      list: (projectId: string) => Promise<Experiment[]>;
      create: (input: Partial<Experiment>) => Promise<Experiment>;
      update: (id: string, input: Partial<Experiment>) => Promise<Experiment>;
    };
    latexVersions: {
      list: (projectId: string) => Promise<LatexVersion[]>;
      create: (input: Partial<LatexVersion>) => Promise<LatexVersion>;
    };
    emails: {
      list: (projectId: string) => Promise<Email[]>;
      create: (input: Partial<Email>) => Promise<Email>;
      update: (id: string, input: Partial<Email>) => Promise<Email>;
    };
    llmConfig: {
      get: () => Promise<LLMConfig | null>;
      update: (config: LLMConfig) => Promise<void>;
    };
    emailConfig: {
      get: () => Promise<EmailConfig | null>;
      save: (config: EmailConfig) => Promise<void>;
      delete: () => Promise<void>;
    };
    gitConfig: {
      get: () => Promise<GitConfig | null>;
      save: (config: GitConfig) => Promise<void>;
    };
    appConfig: {
      get: () => Promise<AppConfig | null>;
      save: (config: AppConfig) => Promise<void>;
    };
  };
  git: {
    getStatus: (repoPath: string) => Promise<GitStatus>;
    getDiff: (repoPath: string, from?: string, to?: string) => Promise<string>;
    getCommits: (repoPath: string, limit?: number) => Promise<GitCommit[]>;
  };
  email: {
    connect: (config: EmailConfig) => Promise<boolean>;
    fetch: (projectId: string) => Promise<Email[]>;
    classify: (emailId: string) => Promise<EmailType>;
    testConnection: (config: EmailConfig) => Promise<EmailTestResult>;
    onEmailFetched: (cb: (email: Email) => void) => () => void;
  };
  llm: {
    summarize: (
      type: 'code' | 'experiment' | 'latex' | 'email' | 'latex_error',
      content: string,
    ) => Promise<string>;
    classifyEmail: (content: string) => Promise<LLMClassifyEmailResult>;
    testConnection: () => Promise<LLMTestResult>;
  };
  dialog: {
    saveFile: (
      defaultName: string,
      filters?: Array<{ name: string; extensions: string[] }>,
    ) => Promise<string | null>;
    openDirectory: () => Promise<string | null>;
    writeFile: (filePath: string, content: string) => Promise<void>;
  };
  latex: {
    getEngineStatus: () => Promise<LatexEngineStatus>;
    ensureEngine: () => Promise<LatexEngineStatus>;
    compile: (source: string) => Promise<LatexCompileResult>;
    compileProject: (projectId: string, mainFile: string) => Promise<LatexCompileResult>;
    getEngineConfig: () => Promise<LatexEngineType>;
    setEngineConfig: (engine: LatexEngineType) => Promise<LatexEngineType>;
    detectSystemEngines: () => Promise<LatexEngineInfo[]>;
    onEngineProgress: (cb: (p: LatexEngineProgress) => void) => () => void;
    onCompileLog: (
      cb: (entry: { stream: 'stdout' | 'stderr'; text: string }) => void,
    ) => () => void;
    // File management
    getStoragePath: () => Promise<{ path: string; isCustom: boolean }>;
    setStoragePath: (path: string | null) => Promise<{ path: string; isCustom: boolean }>;
    importZip: (
      projectId: string,
      zipPath: string,
    ) => Promise<{ files: LatexFileNode[]; mainFile: string | null }>;
    listFiles: (
      projectId: string,
    ) => Promise<{ files: LatexFileNode[]; mainFile: string | null }>;
    readFile: (projectId: string, filePath: string) => Promise<string>;
    readBinaryFile: (projectId: string, filePath: string) => Promise<string>;
    writeFile: (projectId: string, filePath: string, content: string) => Promise<void>;
    deleteFile: (projectId: string, filePath: string) => Promise<void>;
    createFile: (projectId: string, filePath: string, isDirectory: boolean) => Promise<void>;
    renameFile: (projectId: string, oldPath: string, newPath: string) => Promise<void>;
    getMainFile: (projectId: string) => Promise<string | null>;
    setMainFile: (projectId: string, filePath: string) => Promise<void>;
    getFilePath: (file: File) => string;
  };
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    isMaximized: () => Promise<boolean>;
    onMaximizeChange: (cb: (maximized: boolean) => void) => () => void;
  };
}

declare global {
  interface Window {
    api: PaperPilotAPI;
  }
}

export {};
