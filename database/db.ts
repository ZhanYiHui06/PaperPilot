import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import type {
  Project,
  CreateProjectInput,
  ProgressNode,
  CreateProgressNodeInput,
  CodeVersion,
  Experiment,
  LatexVersion,
  Email,
  LLMConfig,
  EmailConfig,
  GitConfig,
  AppConfig,
} from '../shared/types';

let db: Database.Database | null = null;

function getDbPath(): string {
  // In dev mode, userData is redirected to .data/electron by electron/index.ts
  // to avoid TRAE IDE sandbox permission issues with %APPDATA%\paperpilot.
  const isDev = !!process.env.ELECTRON_RENDERER_URL;
  const filename = isDev ? 'paperpilot_dev.db' : 'paperpilot.db';
  return join(app.getPath('userData'), filename);
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function mapProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    target_venue: (row.target_venue as string) ?? null,
    tags: parseJsonArray(row.tags as string),
    phase: row.phase as Project['phase'],
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    status: row.status as Project['status'],
  };
}

export function initDatabase(): void {
  if (db) return;

  const dbPath = getDbPath();
  db = new Database(dbPath);
  // Use MEMORY journal mode — avoids creating -wal/-shm sidecar files
  // which can fail on sandboxed dev environments. Production builds use WAL.
  const isDev = !!process.env.ELECTRON_RENDERER_URL;
  db.pragma(`journal_mode = ${isDev ? 'MEMORY' : 'WAL'}`);

  let schema: string;
  try {
    const devSchemaPath = join(__dirname, '..', '..', 'database', 'schema.sql');
    schema = readFileSync(devSchemaPath, 'utf-8');
  } catch {
    const packagedSchemaPath = join(process.resourcesPath, 'database', 'schema.sql');
    schema = readFileSync(packagedSchemaPath, 'utf-8');
  }
  db.exec(schema);

  // Migration: add message_id column to emails table for existing databases.
  // CREATE TABLE IF NOT EXISTS won't add columns to an existing table, so we
  // check the schema and ALTER if needed. Safe to run every launch.
  const cols = db.prepare("PRAGMA table_info(emails)").all() as { name: string }[];
  if (cols.length > 0 && !cols.some((c) => c.name === 'message_id')) {
    db.exec('ALTER TABLE emails ADD COLUMN message_id TEXT');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id)');

  // Migration: add sync_days to email_config (how far back to sync mail).
  const emailConfigCols = db.prepare('PRAGMA table_info(email_config)').all() as { name: string }[];
  if (emailConfigCols.length > 0 && !emailConfigCols.some((c) => c.name === 'sync_days')) {
    db.exec('ALTER TABLE email_config ADD COLUMN sync_days INTEGER NOT NULL DEFAULT 30');
  }

  // One-time cleanup: remove duplicate emails that were inserted before
  // Message-ID-based deduplication was introduced. For each group of duplicates
  // (same subject + sender + received_at), keep the oldest row (by id — UUIDs
  // are time-ordered via crypto.randomUUID v4 randomness, so we use MIN(id)
  // as a stable tiebreaker) and delete the rest.
  cleanupDuplicateEmails(db);

  // Migration: add file_content column to code_versions for existing databases.
  const codeVersionCols = db.prepare("PRAGMA table_info(code_versions)").all() as { name: string }[];
  if (codeVersionCols.length > 0 && !codeVersionCols.some((c) => c.name === 'file_content')) {
    db.exec('ALTER TABLE code_versions ADD COLUMN file_content TEXT');
  }

  // Migration: add updated_at column to progress_nodes for existing databases.
  // NOTE: SQLite ALTER TABLE ADD COLUMN does not allow non-constant defaults
  // like datetime('now','localtime'), so we add the column as nullable, then
  // backfill existing rows, then enforce NOT NULL.
  const nodeCols = db.prepare("PRAGMA table_info(progress_nodes)").all() as { name: string }[];
  if (nodeCols.length > 0 && !nodeCols.some((c) => c.name === 'updated_at')) {
    db.exec("ALTER TABLE progress_nodes ADD COLUMN updated_at TEXT");
    db.exec("UPDATE progress_nodes SET updated_at = datetime('now', 'localtime') WHERE updated_at IS NULL");
  }

  // Migration: replace old-format progress nodes with the new 6-core-node default.
  // Detects two old formats:
  //   1. phase='submission' (very old, pre-10-phase refactor)
  //   2. Main path has pending nodes with phases beyond the 6 core phases
  //      (10-phase pre-seeded format — these should only be created dynamically)
  const CORE_PHASES = new Set([
    'ideation', 'coding', 'experiment', 'writing', 'pending_submit', 'submitted',
  ]);
  const DYNAMIC_PHASES = ['rejected', 'pending_revise', 'revised', 'accepted'];
  const staleProjects = db.prepare(
    `SELECT DISTINCT project_id FROM progress_nodes
     WHERE parent_branch_id IS NULL
       AND phase IN (${DYNAMIC_PHASES.map(() => '?').join(',')})
       AND status = 'pending'`,
  ).all(...DYNAMIC_PHASES) as { project_id: string }[];
  // Also check for 'submission' phase (very old format)
  const veryOldProjects = db.prepare(
    "SELECT DISTINCT project_id FROM progress_nodes WHERE phase = 'submission'",
  ).all() as { project_id: string }[];
  const projectsToMigrate = new Set([
    ...staleProjects.map((p) => p.project_id),
    ...veryOldProjects.map((p) => p.project_id),
  ]);
  if (projectsToMigrate.size > 0) {
    const newDefaultNodes = [
      { phase: 'ideation', label: '选题', order: 0 },
      { phase: 'coding', label: '编码', order: 1 },
      { phase: 'experiment', label: '实验', order: 2 },
      { phase: 'writing', label: '撰写', order: 3 },
      { phase: 'pending_submit', label: '待投稿', order: 4 },
      { phase: 'submitted', label: '已投稿', order: 5 },
    ];
    const insertNode = db.prepare(
      `INSERT INTO progress_nodes (id, project_id, phase, label, status, order_index) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const projectId of projectsToMigrate) {
      db.prepare('DELETE FROM progress_nodes WHERE project_id = ?').run(projectId);
      for (const node of newDefaultNodes) {
        insertNode.run(
          crypto.randomUUID(),
          projectId,
          node.phase,
          node.label,
          node.order === 0 ? 'in_progress' : 'pending',
          node.order,
        );
      }
      db.prepare('UPDATE projects SET phase = ? WHERE id = ?').run('ideation', projectId);
    }
  }

  // Seed LLM config in dev mode only — production users configure via Settings page.
  // The API key must never be bundled into the production app.
  // Set DEEPSEEK_API_KEY env var to pre-fill the key in dev mode.
  const isDevMode = !!process.env.ELECTRON_RENDERER_URL;
  if (isDevMode) {
    const existing = db.prepare('SELECT id FROM llm_config WHERE id = ?').get('default');
    if (!existing) {
      const seedApiKey = process.env.DEEPSEEK_API_KEY ?? '';
      db.prepare(
        `INSERT INTO llm_config (id, provider, api_key, model, base_url) VALUES (?, ?, ?, ?, ?)`,
      ).run('default', 'openai', seedApiKey, 'deepseek-chat', 'https://api.deepseek.com');
    }
  }
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// Remove duplicate emails inserted before Message-ID deduplication existed.
// Groups by (subject, sender, received_at) and keeps only one row per group.
// Uses MIN(id) as the survivor — a stable, deterministic tiebreaker. Idempotent.
function cleanupDuplicateEmails(database: Database.Database): void {
  database.exec(`
    DELETE FROM emails
    WHERE id NOT IN (
      SELECT MIN(id) FROM emails
      GROUP BY subject, sender, received_at
    )
  `);
}

// ============ Projects ============
export function listProjects(): Project[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM projects WHERE status = ? ORDER BY updated_at DESC').all(
    'active',
  );
  return (rows as Record<string, unknown>[]).map(mapProject);
}

export function getProject(id: string): Project | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapProject(row) : null;
}

export function createProject(input: CreateProjectInput): Project {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const tags = JSON.stringify(input.tags ?? []);
  db.prepare(
    `INSERT INTO projects (id, title, description, target_venue, tags) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, input.title, input.description ?? null, input.target_venue ?? null, tags);

  // Create default progress nodes — 6 core path phases only.
  // Post-submission phases (rejected, pending_revise, revised, accepted) are
  // created dynamically by user actions in the progress graph.
  const defaultNodes = [
    { phase: 'ideation', label: '选题', order: 0 },
    { phase: 'coding', label: '编码', order: 1 },
    { phase: 'experiment', label: '实验', order: 2 },
    { phase: 'writing', label: '撰写', order: 3 },
    { phase: 'pending_submit', label: '待投稿', order: 4 },
    { phase: 'submitted', label: '已投稿', order: 5 },
  ];
  const insertNode = db.prepare(
    `INSERT INTO progress_nodes (id, project_id, phase, label, status, order_index) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const node of defaultNodes) {
    insertNode.run(
      crypto.randomUUID(),
      id,
      node.phase,
      node.label,
      node.order === 0 ? 'in_progress' : 'pending',
      node.order,
    );
  }

  return getProject(id)!;
}

export function updateProject(id: string, input: Partial<Project>): Project {
  const db = getDatabase();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.title !== undefined) {
    fields.push('title = ?');
    values.push(input.title);
  }
  if (input.description !== undefined) {
    fields.push('description = ?');
    values.push(input.description);
  }
  if (input.target_venue !== undefined) {
    fields.push('target_venue = ?');
    values.push(input.target_venue);
  }
  if (input.tags !== undefined) {
    fields.push('tags = ?');
    values.push(JSON.stringify(input.tags));
  }
  if (input.phase !== undefined) {
    fields.push('phase = ?');
    values.push(input.phase);
  }
  if (input.status !== undefined) {
    fields.push('status = ?');
    values.push(input.status);
  }

  fields.push("updated_at = datetime('now', 'localtime')");
  values.push(id);

  db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getProject(id)!;
}

export function deleteProject(id: string): void {
  const db = getDatabase();
  // Delete child records first to avoid FOREIGN KEY constraint failures
  const deleteChildren = db.transaction(() => {
    db.prepare('DELETE FROM emails WHERE project_id = ?').run(id);
    db.prepare('DELETE FROM latex_versions WHERE project_id = ?').run(id);
    db.prepare('DELETE FROM experiments WHERE project_id = ?').run(id);
    db.prepare('DELETE FROM code_versions WHERE project_id = ?').run(id);
    db.prepare('DELETE FROM submission_branches WHERE project_id = ?').run(id);
    db.prepare('DELETE FROM progress_nodes WHERE project_id = ?').run(id);
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  });
  deleteChildren();
}

export function archiveProject(id: string): void {
  const db = getDatabase();
  db.prepare("UPDATE projects SET status = 'archived', updated_at = datetime('now', 'localtime') WHERE id = ?").run(
    id,
  );
}

export function listArchivedProjects(): Project[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM projects WHERE status = ? ORDER BY updated_at DESC').all(
    'archived',
  );
  return (rows as Record<string, unknown>[]).map(mapProject);
}

export function restoreProject(id: string): void {
  const db = getDatabase();
  db.prepare("UPDATE projects SET status = 'active', updated_at = datetime('now', 'localtime') WHERE id = ?").run(
    id,
  );
}

// ============ Progress Nodes ============
function mapProgressNode(row: Record<string, unknown>): ProgressNode {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    phase: row.phase as ProgressNode['phase'],
    label: row.label as string,
    status: row.status as ProgressNode['status'],
    order_index: row.order_index as number,
    parent_branch_id: (row.parent_branch_id as string) ?? null,
    created_at: row.created_at as string,
    updated_at: (row.updated_at as string) ?? row.created_at as string,
  };
}

export function listProgressNodes(projectId: string): ProgressNode[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM progress_nodes WHERE project_id = ? ORDER BY parent_branch_id IS NULL DESC, parent_branch_id ASC, order_index ASC')
    .all(projectId) as Record<string, unknown>[];
  return rows.map(mapProgressNode);
}

export function createProgressNode(input: CreateProgressNodeInput): ProgressNode {
  const db = getDatabase();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO progress_nodes (id, project_id, phase, label, status, order_index, parent_branch_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.project_id,
    input.phase,
    input.label,
    input.status ?? 'pending',
    input.order_index,
    input.parent_branch_id ?? null,
  );
  const row = db.prepare('SELECT * FROM progress_nodes WHERE id = ?').get(id) as Record<string, unknown>;
  return mapProgressNode(row);
}

export function deleteProgressNode(id: string): void {
  const db = getDatabase();
  // Delete the node and its branch children
  db.prepare('DELETE FROM progress_nodes WHERE id = ? OR parent_branch_id = ?').run(id, id);
}

export function updateProgressNode(id: string, input: Partial<ProgressNode>): ProgressNode {
  const db = getDatabase();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.status !== undefined) {
    fields.push('status = ?');
    values.push(input.status);
  }
  if (input.label !== undefined) {
    fields.push('label = ?');
    values.push(input.label);
  }
  if (input.phase !== undefined) {
    fields.push('phase = ?');
    values.push(input.phase);
  }
  if (input.order_index !== undefined) {
    fields.push('order_index = ?');
    values.push(input.order_index);
  }

  if (fields.length === 0) {
    const row = db.prepare('SELECT * FROM progress_nodes WHERE id = ?').get(id) as Record<string, unknown>;
    return mapProgressNode(row);
  }

  fields.push("updated_at = datetime('now', 'localtime')");
  values.push(id);
  db.prepare(`UPDATE progress_nodes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const row = db.prepare('SELECT * FROM progress_nodes WHERE id = ?').get(id) as Record<string, unknown>;
  return mapProgressNode(row);
}

// ============ Code Versions ============
export function listCodeVersions(projectId: string): CodeVersion[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM code_versions WHERE project_id = ? ORDER BY timestamp DESC')
    .all(projectId) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as string,
    project_id: row.project_id as string,
    version_label: row.version_label as string,
    ai_summary: (row.ai_summary as string) ?? null,
    timestamp: row.timestamp as string,
    git_commit_hash: (row.git_commit_hash as string) ?? null,
    diff_text: (row.diff_text as string) ?? null,
    tags: parseJsonArray(row.tags as string),
    file_content: (row.file_content as string) ?? null,
  }));
}

export function createCodeVersion(input: Partial<CodeVersion>): CodeVersion {
  const db = getDatabase();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO code_versions (id, project_id, version_label, ai_summary, git_commit_hash, diff_text, tags, file_content)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.project_id,
    input.version_label,
    input.ai_summary ?? null,
    input.git_commit_hash ?? null,
    input.diff_text ?? null,
    input.tags ? JSON.stringify(input.tags) : null,
    input.file_content ?? null,
  );
  const row = db.prepare('SELECT * FROM code_versions WHERE id = ?').get(id) as Record<string, unknown>;
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    version_label: row.version_label as string,
    ai_summary: (row.ai_summary as string) ?? null,
    timestamp: row.timestamp as string,
    git_commit_hash: (row.git_commit_hash as string) ?? null,
    diff_text: (row.diff_text as string) ?? null,
    tags: parseJsonArray(row.tags as string),
    file_content: (row.file_content as string) ?? null,
  };
}

// Persist a partial update to a code version row. Used by the Code Manager
// to save AI summaries that are regenerated after the version was first created.
export function updateCodeVersion(id: string, input: Partial<CodeVersion>): CodeVersion {
  const db = getDatabase();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.version_label !== undefined) {
    fields.push('version_label = ?');
    values.push(input.version_label);
  }
  if (input.ai_summary !== undefined) {
    fields.push('ai_summary = ?');
    values.push(input.ai_summary);
  }
  if (input.git_commit_hash !== undefined) {
    fields.push('git_commit_hash = ?');
    values.push(input.git_commit_hash);
  }
  if (input.diff_text !== undefined) {
    fields.push('diff_text = ?');
    values.push(input.diff_text);
  }
  if (input.tags !== undefined) {
    fields.push('tags = ?');
    values.push(input.tags ? JSON.stringify(input.tags) : null);
  }
  if (input.file_content !== undefined) {
    fields.push('file_content = ?');
    values.push(input.file_content);
  }

  if (fields.length === 0) {
    const row = db.prepare('SELECT * FROM code_versions WHERE id = ?').get(id) as Record<string, unknown>;
    return {
      id: row.id as string,
      project_id: row.project_id as string,
      version_label: row.version_label as string,
      ai_summary: (row.ai_summary as string) ?? null,
      timestamp: row.timestamp as string,
      git_commit_hash: (row.git_commit_hash as string) ?? null,
      diff_text: (row.diff_text as string) ?? null,
      tags: parseJsonArray(row.tags as string),
      file_content: (row.file_content as string) ?? null,
    };
  }

  values.push(id);
  db.prepare(`UPDATE code_versions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const row = db.prepare('SELECT * FROM code_versions WHERE id = ?').get(id) as Record<string, unknown>;
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    version_label: row.version_label as string,
    ai_summary: (row.ai_summary as string) ?? null,
    timestamp: row.timestamp as string,
    git_commit_hash: (row.git_commit_hash as string) ?? null,
    diff_text: (row.diff_text as string) ?? null,
    tags: parseJsonArray(row.tags as string),
    file_content: (row.file_content as string) ?? null,
  };
}

export function deleteCodeVersion(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM code_versions WHERE id = ?').run(id);
}

// ============ Experiments ============
export function listExperiments(projectId: string): Experiment[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM experiments WHERE project_id = ? ORDER BY created_at DESC')
    .all(projectId) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as string,
    project_id: row.project_id as string,
    name: row.name as string,
    experiment_type: row.experiment_type as Experiment['experiment_type'],
    dataset: (row.dataset as string) ?? null,
    model: (row.model as string) ?? null,
    hyperparameters: parseJsonObject(row.hyperparameters as string),
    metrics: parseJsonObject(row.metrics as string),
    notes: (row.notes as string) ?? null,
    status: row.status as string,
    created_at: row.created_at as string,
  }));
}

export function createExperiment(input: Partial<Experiment>): Experiment {
  const db = getDatabase();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO experiments (id, project_id, name, experiment_type, dataset, model, hyperparameters, metrics, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.project_id,
    input.name,
    input.experiment_type,
    input.dataset ?? null,
    input.model ?? null,
    input.hyperparameters ? JSON.stringify(input.hyperparameters) : null,
    input.metrics ? JSON.stringify(input.metrics) : null,
    input.notes ?? null,
  );
  const row = db.prepare('SELECT * FROM experiments WHERE id = ?').get(id) as Record<string, unknown>;
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    name: row.name as string,
    experiment_type: row.experiment_type as Experiment['experiment_type'],
    dataset: (row.dataset as string) ?? null,
    model: (row.model as string) ?? null,
    hyperparameters: parseJsonObject(row.hyperparameters as string),
    metrics: parseJsonObject(row.metrics as string),
    notes: (row.notes as string) ?? null,
    status: row.status as string,
    created_at: row.created_at as string,
  };
}

export function updateExperiment(id: string, input: Partial<Experiment>): Experiment {
  const db = getDatabase();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) {
    fields.push('name = ?');
    values.push(input.name);
  }
  if (input.experiment_type !== undefined) {
    fields.push('experiment_type = ?');
    values.push(input.experiment_type);
  }
  if (input.dataset !== undefined) {
    fields.push('dataset = ?');
    values.push(input.dataset);
  }
  if (input.model !== undefined) {
    fields.push('model = ?');
    values.push(input.model);
  }
  if (input.hyperparameters !== undefined) {
    fields.push('hyperparameters = ?');
    values.push(input.hyperparameters ? JSON.stringify(input.hyperparameters) : null);
  }
  if (input.metrics !== undefined) {
    fields.push('metrics = ?');
    values.push(input.metrics ? JSON.stringify(input.metrics) : null);
  }
  if (input.notes !== undefined) {
    fields.push('notes = ?');
    values.push(input.notes);
  }
  if (input.status !== undefined) {
    fields.push('status = ?');
    values.push(input.status);
  }

  if (fields.length === 0) {
    const row = db.prepare('SELECT * FROM experiments WHERE id = ?').get(id) as Record<string, unknown>;
    return row as unknown as Experiment;
  }

  values.push(id);
  db.prepare(`UPDATE experiments SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const row = db.prepare('SELECT * FROM experiments WHERE id = ?').get(id) as Record<string, unknown>;
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    name: row.name as string,
    experiment_type: row.experiment_type as Experiment['experiment_type'],
    dataset: (row.dataset as string) ?? null,
    model: (row.model as string) ?? null,
    hyperparameters: parseJsonObject(row.hyperparameters as string),
    metrics: parseJsonObject(row.metrics as string),
    notes: (row.notes as string) ?? null,
    status: row.status as string,
    created_at: row.created_at as string,
  };
}

// ============ LaTeX Versions ============
export function listLatexVersions(projectId: string): LatexVersion[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM latex_versions WHERE project_id = ? ORDER BY timestamp DESC')
    .all(projectId) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as string,
    project_id: row.project_id as string,
    version_label: row.version_label as string,
    ai_summary: (row.ai_summary as string) ?? null,
    timestamp: row.timestamp as string,
    git_commit_hash: (row.git_commit_hash as string) ?? null,
  }));
}

export function createLatexVersion(input: Partial<LatexVersion>): LatexVersion {
  const db = getDatabase();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO latex_versions (id, project_id, version_label, ai_summary, git_commit_hash)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.project_id,
    input.version_label,
    input.ai_summary ?? null,
    input.git_commit_hash ?? null,
  );
  const row = db.prepare('SELECT * FROM latex_versions WHERE id = ?').get(id) as Record<string, unknown>;
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    version_label: row.version_label as string,
    ai_summary: (row.ai_summary as string) ?? null,
    timestamp: row.timestamp as string,
    git_commit_hash: (row.git_commit_hash as string) ?? null,
  };
}

// ============ Emails ============

// Maps a DB row to an Email object — shared by all email read functions.
function mapEmail(row: Record<string, unknown>): Email {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    subject: row.subject as string,
    sender: row.sender as string,
    received_at: row.received_at as string,
    email_type: (row.email_type as Email['email_type']) ?? null,
    ai_summary: (row.ai_summary as string) ?? null,
    is_read: row.is_read as number,
    is_important: row.is_important as number,
    raw_content: (row.raw_content as string) ?? null,
    message_id: (row.message_id as string) ?? null,
  };
}

export function insertEmail(email: Partial<Email>): Email {
  const db = getDatabase();
  const id = email.id ?? crypto.randomUUID();
  db.prepare(
    `INSERT OR REPLACE INTO emails
      (id, project_id, subject, sender, received_at, email_type, ai_summary, is_read, is_important, raw_content, message_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    email.project_id,
    email.subject ?? '(no subject)',
    email.sender ?? 'unknown',
    email.received_at ?? new Date().toISOString(),
    email.email_type ?? null,
    email.ai_summary ?? null,
    email.is_read ?? 0,
    email.is_important ?? 0,
    email.raw_content ?? null,
    email.message_id ?? null,
  );
  return getEmailById(id)!;
}

export function getEmailById(id: string): Email | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM emails WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return mapEmail(row);
}

// Find an existing email by its RFC 822 Message-ID header — the most reliable
// natural key for deduplication. IMAP polling returns the same message each
// time; without this check the same email gets re-inserted with a fresh UUID.
export function findEmailByMessageId(projectId: string, messageId: string): Email | null {
  const db = getDatabase();
  const row = db
    .prepare(
      'SELECT * FROM emails WHERE project_id = ? AND message_id = ? LIMIT 1',
    )
    .get(projectId, messageId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return mapEmail(row);
}

// Find an existing email by its natural key (project_id + subject + sender + received_at).
// Used as a fallback deduplication when Message-ID is unavailable.
export function findEmailByNaturalKey(
  projectId: string,
  subject: string,
  sender: string,
  receivedAt: string,
): Email | null {
  const db = getDatabase();
  const row = db
    .prepare(
      'SELECT * FROM emails WHERE project_id = ? AND subject = ? AND sender = ? AND received_at = ? LIMIT 1',
    )
    .get(projectId, subject, sender, receivedAt) as Record<string, unknown> | undefined;
  if (!row) return null;
  return mapEmail(row);
}

export function listEmails(projectId: string): Email[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM emails WHERE project_id = ? ORDER BY received_at DESC')
    .all(projectId) as Record<string, unknown>[];
  return rows.map(mapEmail);
}

export function updateEmail(id: string, input: Partial<Email>): Email {
  const db = getDatabase();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.email_type !== undefined) {
    fields.push('email_type = ?');
    values.push(input.email_type);
  }
  if (input.ai_summary !== undefined) {
    fields.push('ai_summary = ?');
    values.push(input.ai_summary);
  }
  if (input.is_read !== undefined) {
    fields.push('is_read = ?');
    values.push(input.is_read);
  }
  if (input.is_important !== undefined) {
    fields.push('is_important = ?');
    values.push(input.is_important);
  }
  if (input.message_id !== undefined) {
    fields.push('message_id = ?');
    values.push(input.message_id);
  }

  if (fields.length === 0) {
    const row = db.prepare('SELECT * FROM emails WHERE id = ?').get(id) as Record<string, unknown>;
    return mapEmail(row);
  }

  values.push(id);
  db.prepare(`UPDATE emails SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const row = db.prepare('SELECT * FROM emails WHERE id = ?').get(id) as Record<string, unknown>;
  return mapEmail(row);
}

// ============ Config Tables ============
export function getLLMConfig(): LLMConfig | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM llm_config WHERE id = ?').get('default') as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    provider: row.provider as string,
    api_key: (row.api_key as string) ?? '',
    model: row.model as string,
    base_url: (row.base_url as string) ?? '',
    updated_at: row.updated_at as string,
  };
}

export function updateLLMConfig(config: LLMConfig): void {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO llm_config (id, provider, api_key, model, base_url, updated_at)
     VALUES ('default', ?, ?, ?, ?, datetime('now', 'localtime'))
     ON CONFLICT(id) DO UPDATE SET
       provider = excluded.provider,
       api_key = excluded.api_key,
       model = excluded.model,
       base_url = excluded.base_url,
       updated_at = datetime('now', 'localtime')`,
  ).run(config.provider, config.api_key, config.model, config.base_url);
}

const DEFAULT_SYNC_DAYS = 30;

function normalizeSyncDays(value: unknown): EmailConfig['sync_days'] {
  const n = typeof value === 'number' ? value : Number(value);
  if (n === 7 || n === 30 || n === 90 || n === 180 || n === 365) return n;
  return DEFAULT_SYNC_DAYS;
}

export function getEmailConfig(): EmailConfig | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM email_config WHERE id = ?').get('default') as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    host: row.host as string,
    port: row.port as number,
    username: row.username as string,
    password: row.password as string,
    ssl: row.ssl as number,
    sync_days: normalizeSyncDays(row.sync_days),
    updated_at: row.updated_at as string,
  };
}

export function saveEmailConfig(config: EmailConfig): void {
  const db = getDatabase();
  const syncDays = normalizeSyncDays(config.sync_days ?? DEFAULT_SYNC_DAYS);
  db.prepare(
    `INSERT INTO email_config (id, host, port, username, password, ssl, sync_days, updated_at)
     VALUES ('default', ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
     ON CONFLICT(id) DO UPDATE SET
       host = excluded.host,
       port = excluded.port,
       username = excluded.username,
       password = excluded.password,
       ssl = excluded.ssl,
       sync_days = excluded.sync_days,
       updated_at = datetime('now', 'localtime')`,
  ).run(
    config.host,
    config.port,
    config.username,
    config.password,
    config.ssl ? 1 : 0,
    syncDays,
  );
}

export function deleteEmailConfig(): void {
  const db = getDatabase();
  db.prepare('DELETE FROM email_config WHERE id = ?').run('default');
}

export function getGitConfig(): GitConfig | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM git_config WHERE id = ?').get('default') as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    default_repo_path: (row.default_repo_path as string) ?? '',
    updated_at: row.updated_at as string,
  };
}

export function saveGitConfig(config: GitConfig): void {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO git_config (id, default_repo_path, updated_at)
     VALUES ('default', ?, datetime('now', 'localtime'))
     ON CONFLICT(id) DO UPDATE SET
       default_repo_path = excluded.default_repo_path,
       updated_at = datetime('now', 'localtime')`,
  ).run(config.default_repo_path);
}

export function getAppConfig(): AppConfig | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM app_config WHERE id = ?').get('default') as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    theme: row.theme as 'light' | 'dark',
    updated_at: row.updated_at as string,
  };
}

export function saveAppConfig(config: AppConfig): void {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO app_config (id, theme, updated_at)
     VALUES ('default', ?, datetime('now', 'localtime'))
     ON CONFLICT(id) DO UPDATE SET
       theme = excluded.theme,
       updated_at = datetime('now', 'localtime')`,
  ).run(config.theme);
}
