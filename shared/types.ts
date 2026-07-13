// Shared types used by both Electron main and React renderer

export type ProjectPhase =
  | 'ideation'       // 选题
  | 'coding'         // 编码
  | 'experiment'     // 实验
  | 'writing'        // 撰写
  | 'pending_submit' // 待投稿
  | 'submitted'      // 已投稿
  | 'rejected'       // 被拒稿
  | 'pending_revise' // 待返修
  | 'revised'        // 已返修
  | 'accepted';      // 已录用

export type ProjectStatus = 'active' | 'archived';

export interface Project {
  id: string;
  title: string;
  description: string | null;
  target_venue: string | null;
  tags: string[];
  phase: ProjectPhase;
  created_at: string;
  updated_at: string;
  status: ProjectStatus;
}

export interface CreateProjectInput {
  title: string;
  description?: string;
  target_venue?: string;
  tags?: string[];
}

export type ProgressNodeStatus = 'pending' | 'in_progress' | 'done' | 'skipped';

export interface ProgressNode {
  id: string;
  project_id: string;
  phase: ProjectPhase;
  label: string;
  status: ProgressNodeStatus;
  order_index: number;
  parent_branch_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProgressNodeInput {
  project_id: string;
  phase: ProjectPhase;
  label: string;
  order_index: number;
  parent_branch_id?: string | null;
  status?: ProgressNodeStatus;
}

export interface SubmissionBranch {
  id: string;
  project_id: string;
  label: string;
  target_venue: string | null;
  status: string;
  created_at: string;
}

export interface CodeVersion {
  id: string;
  project_id: string;
  version_label: string;
  ai_summary: string | null;
  timestamp: string;
  git_commit_hash: string | null;
  diff_text: string | null;
  tags: string[] | null;
  file_content: string | null;
}

export type ExperimentType = 'comparison' | 'ablation' | 'sensitivity' | 'other';

export interface Experiment {
  id: string;
  project_id: string;
  name: string;
  experiment_type: ExperimentType;
  dataset: string | null;
  model: string | null;
  hyperparameters: Record<string, unknown> | null;
  metrics: Record<string, unknown> | null;
  notes: string | null;
  status: string;
  created_at: string;
}

export interface LatexVersion {
  id: string;
  project_id: string;
  version_label: string;
  ai_summary: string | null;
  timestamp: string;
  git_commit_hash: string | null;
}

export type EmailType = 'review' | 'decision' | 'revision' | 'other';

export interface Email {
  id: string;
  project_id: string;
  subject: string;
  sender: string;
  received_at: string;
  email_type: EmailType | null;
  ai_summary: string | null;
  is_read: number;
  is_important: number;
  raw_content: string | null;
  message_id: string | null;
}

export interface LLMConfig {
  id?: string;
  provider: string;
  api_key: string;
  model: string;
  base_url: string;
  updated_at?: string;
}

/** How far back IMAP sync should look for messages. */
export type EmailSyncDays = 7 | 30 | 90 | 180 | 365;

export interface EmailConfig {
  id?: string;
  host: string;
  port: number;
  username: string;
  password: string;
  ssl: number;
  /** Sync window in days (default 30). */
  sync_days?: EmailSyncDays;
  updated_at?: string;
}

export interface GitConfig {
  id?: string;
  default_repo_path: string;
  updated_at?: string;
}

export interface AppConfig {
  id?: string;
  theme: 'light' | 'dark';
  updated_at?: string;
}

export interface GitStatus {
  modified: string[];
  deleted: string[];
  created: string[];
  ahead: number;
  behind: number;
}

export interface GitCommit {
  hash: string;
  date: string;
  message: string;
  author: string;
}

export interface EmailTestResult {
  success: boolean;
  message: string;
}

export interface LLMTestResult {
  success: boolean;
  message: string;
}

export interface LLMClassifyEmailResult {
  type: EmailType;
  summary: string;
}

// Structured experiment data parsed from log files by the LLM.
// Represents a methods × metrics results table on a given dataset.
export interface ParsedExperimentData {
  dataset: string | null;
  metric_names: string[];
  methods: Array<{
    name: string;
    values: string[];
  }>;
}

// LaTeX compilation result returned by the main process.
// `pdfBase64` is undefined when compilation fails; `log` always contains
// the full stdout+stderr captured from the engine for diagnostics.
export interface LatexCompileResult {
  success: boolean;
  pdfBase64?: string;
  log: string;
  errors: string[];
  outputName: string;
}

// File tree node for LaTeX project file management.
export interface LatexFileNode {
  name: string;
  path: string; // relative to project root, e.g. "figures/fig1.png"
  type: 'file' | 'directory';
  children?: LatexFileNode[];
  isMain?: boolean;
}

// Status of the bundled Tectonic engine.
export type LatexEngineStatus =
  | { installed: true; version: string; binaryPath: string }
  | { installed: false; version: null; binaryPath: null };

// LaTeX compiler engine selection.
// - tectonic: bundled self-contained engine (XeTeX-based, auto-downloads)
// - pdflatex / xelatex / lualatex: require a system TeX distribution (TeX Live / MiKTeX / MacTeX)
export type LatexEngineType = 'tectonic' | 'pdflatex' | 'xelatex' | 'lualatex';

// Info about a single system TeX engine detected on PATH.
export interface LatexEngineInfo {
  name: LatexEngineType;
  label: string;
  available: boolean;
  version: string | null;
  path: string | null;
}

// Progress events streamed from the main process during engine setup.
export type LatexEngineProgress =
  | { stage: 'download'; message: string; percent?: number }
  | { stage: 'extract'; message: string }
  | { stage: 'verify'; message: string }
  | { stage: 'done'; message: string }
  | { stage: 'error'; message: string };

// IPC channel constants
export const IPC_CHANNELS = {
  DB_PROJECTS_LIST: 'db:projects:list',
  DB_PROJECTS_GET: 'db:projects:get',
  DB_PROJECTS_CREATE: 'db:projects:create',
  DB_PROJECTS_UPDATE: 'db:projects:update',
  DB_PROJECTS_DELETE: 'db:projects:delete',
  DB_PROJECTS_ARCHIVE: 'db:projects:archive',
  DB_PROJECTS_LIST_ARCHIVED: 'db:projects:listArchived',
  DB_PROJECTS_RESTORE: 'db:projects:restore',

  DB_PROGRESS_NODES_LIST: 'db:progressNodes:list',
  DB_PROGRESS_NODES_CREATE: 'db:progressNodes:create',
  DB_PROGRESS_NODES_UPDATE: 'db:progressNodes:update',
  DB_PROGRESS_NODES_DELETE: 'db:progressNodes:delete',

  DB_CODE_VERSIONS_LIST: 'db:codeVersions:list',
  DB_CODE_VERSIONS_CREATE: 'db:codeVersions:create',
  DB_CODE_VERSIONS_UPDATE: 'db:codeVersions:update',
  DB_CODE_VERSIONS_DELETE: 'db:codeVersions:delete',

  DB_EXPERIMENTS_LIST: 'db:experiments:list',
  DB_EXPERIMENTS_CREATE: 'db:experiments:create',
  DB_EXPERIMENTS_UPDATE: 'db:experiments:update',

  DB_LATEX_VERSIONS_LIST: 'db:latexVersions:list',
  DB_LATEX_VERSIONS_CREATE: 'db:latexVersions:create',

  DB_EMAILS_LIST: 'db:emails:list',
  DB_EMAILS_CREATE: 'db:emails:create',
  DB_EMAILS_UPDATE: 'db:emails:update',

  DB_LLM_CONFIG_GET: 'db:llmConfig:get',
  DB_LLM_CONFIG_UPDATE: 'db:llmConfig:update',

  DB_EMAIL_CONFIG_GET: 'db:emailConfig:get',
  DB_EMAIL_CONFIG_SAVE: 'db:emailConfig:save',
  DB_EMAIL_CONFIG_DELETE: 'db:emailConfig:delete',

  DB_GIT_CONFIG_GET: 'db:gitConfig:get',
  DB_GIT_CONFIG_SAVE: 'db:gitConfig:save',

  DB_APP_CONFIG_GET: 'db:appConfig:get',
  DB_APP_CONFIG_SAVE: 'db:appConfig:save',

  GIT_GET_STATUS: 'git:getStatus',
  GIT_GET_DIFF: 'git:getDiff',
  GIT_GET_COMMITS: 'git:getCommits',

  EMAIL_CONNECT: 'email:connect',
  EMAIL_FETCH: 'email:fetch',
  EMAIL_CLASSIFY: 'email:classify',
  EMAIL_TEST_CONNECTION: 'email:testConnection',

  LLM_SUMMARIZE: 'llm:summarize',
  LLM_CLASSIFY_EMAIL: 'llm:classifyEmail',
  LLM_PARSE_EXPERIMENT: 'llm:parseExperiment',
  LLM_TEST_CONNECTION: 'llm:testConnection',

  DIALOG_SAVE_FILE: 'dialog:saveFile',
  DIALOG_OPEN_DIRECTORY: 'dialog:openDirectory',
  DIALOG_WRITE_FILE: 'dialog:writeFile',

  LATEX_COMPILE: 'latex:compile',
  LATEX_COMPILE_PROJECT: 'latex:compileProject',
  LATEX_ENSURE_ENGINE: 'latex:ensureEngine',
  LATEX_GET_ENGINE_STATUS: 'latex:getEngineStatus',
  LATEX_GET_ENGINE_CONFIG: 'latex:getEngineConfig',
  LATEX_SET_ENGINE_CONFIG: 'latex:setEngineConfig',
  LATEX_DETECT_SYSTEM_ENGINES: 'latex:detectSystemEngines',
  LATEX_GET_STORAGE_PATH: 'latex:getStoragePath',
  LATEX_SET_STORAGE_PATH: 'latex:setStoragePath',
  LATEX_IMPORT_ZIP: 'latex:importZip',
  LATEX_LIST_FILES: 'latex:listFiles',
  LATEX_READ_FILE: 'latex:readFile',
  LATEX_READ_BINARY_FILE: 'latex:readBinaryFile',
  LATEX_WRITE_FILE: 'latex:writeFile',
  LATEX_DELETE_FILE: 'latex:deleteFile',
  LATEX_CREATE_FILE: 'latex:createFile',
  LATEX_RENAME_FILE: 'latex:renameFile',
  LATEX_GET_MAIN_FILE: 'latex:getMainFile',
  LATEX_SET_MAIN_FILE: 'latex:setMainFile',
  LATEX_GET_FILE_PATH: 'latex:getFilePath',

  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:isMaximized',
} as const;
