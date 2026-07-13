-- PaperPilot v3 Database Schema

-- Paper projects
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  target_venue TEXT,
  tags TEXT DEFAULT '[]',
  phase TEXT NOT NULL DEFAULT 'ideation',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  status TEXT NOT NULL DEFAULT 'active'
);

-- Progress nodes (timeline graph)
CREATE TABLE IF NOT EXISTS progress_nodes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  phase TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  order_index INTEGER NOT NULL,
  parent_branch_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Submission branches
CREATE TABLE IF NOT EXISTS submission_branches (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  label TEXT NOT NULL,
  target_venue TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Code versions
CREATE TABLE IF NOT EXISTS code_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  version_label TEXT NOT NULL,
  ai_summary TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  git_commit_hash TEXT,
  diff_text TEXT,
  tags TEXT,
  file_content TEXT
);

-- Experiment records
CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  experiment_type TEXT NOT NULL,
  dataset TEXT,
  model TEXT,
  hyperparameters TEXT,
  metrics TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- LaTeX document versions
CREATE TABLE IF NOT EXISTS latex_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  version_label TEXT NOT NULL,
  ai_summary TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  git_commit_hash TEXT
);

-- Email records
CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  subject TEXT NOT NULL,
  sender TEXT NOT NULL,
  received_at TEXT NOT NULL,
  email_type TEXT,
  ai_summary TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  is_important INTEGER NOT NULL DEFAULT 0,
  raw_content TEXT,
  message_id TEXT
);

-- LLM configuration
CREATE TABLE IF NOT EXISTS llm_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  provider TEXT NOT NULL,
  api_key TEXT,
  model TEXT NOT NULL,
  base_url TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Email configuration (IMAP)
CREATE TABLE IF NOT EXISTS email_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 993,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  ssl INTEGER NOT NULL DEFAULT 1,
  sync_days INTEGER NOT NULL DEFAULT 30,
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Git configuration
CREATE TABLE IF NOT EXISTS git_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  default_repo_path TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- App configuration (appearance, etc.)
CREATE TABLE IF NOT EXISTS app_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  theme TEXT NOT NULL DEFAULT 'light',
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_progress_nodes_project ON progress_nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_code_versions_project ON code_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_experiments_project ON experiments(project_id);
CREATE INDEX IF NOT EXISTS idx_latex_versions_project ON latex_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_emails_project ON emails(project_id);
