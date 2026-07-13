/**
 * Dev-only mock for window.api when running outside Electron (e.g., TRAE built-in browser).
 * Backed by localStorage so projects/nodes/versions persist across reloads in the same origin.
 * Provides the same shape as the real IPC API so the UI can render for visual inspection.
 */

type AnyRecord = Record<string, any>;

const STORAGE_KEY = 'paperpilot-mock-db';

interface MockDB {
  projects: AnyRecord[];
  progressNodes: AnyRecord[];
  codeVersions: AnyRecord[];
  experiments: AnyRecord[];
  latexVersions: AnyRecord[];
  emails: AnyRecord[];
  llmConfig: AnyRecord | null;
  emailConfig: AnyRecord | null;
  gitConfig: AnyRecord | null;
  appConfig: { theme: 'light' | 'dark'; sidebarCollapsed: boolean };
}

function emptyDB(): MockDB {
  return {
    projects: [],
    progressNodes: [],
    codeVersions: [],
    experiments: [],
    latexVersions: [],
    emails: [],
    llmConfig: {
      id: 'default',
      provider: 'openai',
      api_key: '',
      model: 'deepseek-chat',
      base_url: 'https://api.deepseek.com',
    },
    emailConfig: { id: 'default', host: '', port: 993, user: '', password: '', ssl: true },
    gitConfig: { id: 'default', repoPath: '', branch: 'main', remote: 'origin' },
    appConfig: { theme: 'light', sidebarCollapsed: false },
  };
}

function loadDB(): MockDB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDB();
    return { ...emptyDB(), ...JSON.parse(raw) };
  } catch {
    return emptyDB();
  }
}

function saveDB(db: MockDB): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // ignore quota errors
  }
}

function nowISO(): string {
  return new Date().toISOString();
}

function uuid(): string {
  return 'mock-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

export function resetMockDB(): void {
  localStorage.removeItem(STORAGE_KEY);
  // eslint-disable-next-line no-console
  console.info('[PaperPilot mock] localStorage cleared');
}

export function injectApiMockIfMissing(): void {
  if (typeof window !== 'undefined' && !(window as any).api) {
    const state = loadDB();

    // ─── Migration: replace old-format progress nodes with 6-core-node default ───
    // Detects:
    //   1. Nodes with obsolete phase values (e.g. 'submission')
    //   2. Main-path nodes with dynamic phases (rejected/pending_revise/revised/accepted)
    //      that are still 'pending' — left over from the 10-node pre-seeded format
    const ALL_VALID_PHASES = new Set([
      'ideation', 'coding', 'experiment', 'writing', 'pending_submit',
      'submitted', 'rejected', 'pending_revise', 'revised', 'accepted',
    ]);
    const DYNAMIC_PHASES = new Set(['rejected', 'pending_revise', 'revised', 'accepted']);
    const coreDefaultNodes = [
      { phase: 'ideation', label: '选题', order: 0 },
      { phase: 'coding', label: '编码', order: 1 },
      { phase: 'experiment', label: '实验', order: 2 },
      { phase: 'writing', label: '撰写', order: 3 },
      { phase: 'pending_submit', label: '待投稿', order: 4 },
      { phase: 'submitted', label: '已投稿', order: 5 },
    ];
    const projectIdsWithOldNodes = new Set<string>();
    for (const node of state.progressNodes) {
      if (!ALL_VALID_PHASES.has(node.phase)) {
        projectIdsWithOldNodes.add(node.project_id);
      }
      // 10-node pre-seeded format: dynamic phase on main path with 'pending' status
      if (DYNAMIC_PHASES.has(node.phase) && node.status === 'pending' && !node.parent_branch_id) {
        projectIdsWithOldNodes.add(node.project_id);
      }
    }
    for (const pid of projectIdsWithOldNodes) {
      state.progressNodes = state.progressNodes.filter((n) => n.project_id !== pid);
      for (const node of coreDefaultNodes) {
        state.progressNodes.push({
          id: uuid(),
          project_id: pid,
          phase: node.phase,
          label: node.label,
          status: node.order === 0 ? 'in_progress' : 'pending',
          order_index: node.order,
          parent_branch_id: null,
          created_at: nowISO(),
          updated_at: nowISO(),
        });
      }
    }
    // Reset any project with a stale phase value
    for (const p of state.projects) {
      if (!ALL_VALID_PHASES.has(p.phase)) {
        p.phase = 'ideation';
      }
    }
    if (projectIdsWithOldNodes.size > 0) {
      saveDB(state);
    }

    const persist = () => saveDB(state);

    (window as any).api = {
      db: {
        projects: {
          list: async () => [...state.projects],
          get: async (id: string) => state.projects.find((p) => p.id === id) ?? null,
          create: async (input: AnyRecord) => {
            const project = {
              id: uuid(),
              title: input?.title ?? 'Untitled',
              description: input?.description ?? null,
              target_venue: input?.target_venue ?? null,
              tags: input?.tags ?? [],
              phase: input?.phase ?? 'ideation',
              status: 'active',
              created_at: nowISO(),
              updated_at: nowISO(),
            };
            state.projects.unshift(project);
            // Create default progress nodes — 6 core path phases only.
            // Post-submission phases are created dynamically by user actions.
            const defaultNodes = [
              { phase: 'ideation', label: '选题', order: 0 },
              { phase: 'coding', label: '编码', order: 1 },
              { phase: 'experiment', label: '实验', order: 2 },
              { phase: 'writing', label: '撰写', order: 3 },
              { phase: 'pending_submit', label: '待投稿', order: 4 },
              { phase: 'submitted', label: '已投稿', order: 5 },
            ];
            for (const node of defaultNodes) {
              state.progressNodes.push({
                id: uuid(),
                project_id: project.id,
                phase: node.phase,
                label: node.label,
                status: node.order === 0 ? 'in_progress' : 'pending',
                order_index: node.order,
                parent_branch_id: null,
                created_at: nowISO(),
                updated_at: nowISO(),
              });
            }
            persist();
            return project;
          },
          update: async (id: string, input: AnyRecord) => {
            const idx = state.projects.findIndex((p) => p.id === id);
            if (idx < 0) throw new Error('Project not found');
            state.projects[idx] = { ...state.projects[idx], ...input, updated_at: nowISO() };
            persist();
            return state.projects[idx];
          },
          delete: async (id: string) => {
            state.projects = state.projects.filter((p) => p.id !== id);
            state.progressNodes = state.progressNodes.filter((n) => n.project_id !== id);
            state.codeVersions = state.codeVersions.filter((n) => n.project_id !== id);
            state.experiments = state.experiments.filter((n) => n.project_id !== id);
            state.latexVersions = state.latexVersions.filter((n) => n.project_id !== id);
            state.emails = state.emails.filter((n) => n.project_id !== id);
            persist();
          },
          archive: async (id: string) => {
            const p = state.projects.find((x) => x.id === id);
            if (p) {
              p.status = 'archived';
              p.updated_at = nowISO();
              persist();
            }
          },
        },
        progressNodes: {
          list: async (projectId: string) =>
            state.progressNodes.filter((n) => n.project_id === projectId),
          create: async (input: AnyRecord) => {
            const node = {
              id: uuid(),
              project_id: input.project_id,
              phase: input.phase ?? 'ideation',
              label: input.label ?? '新节点',
              status: input.status ?? 'pending',
              order_index: input.order_index ?? 0,
              parent_branch_id: input.parent_branch_id ?? null,
              created_at: nowISO(),
              updated_at: nowISO(),
            };
            state.progressNodes.push(node);
            persist();
            return node;
          },
          update: async (id: string, input: AnyRecord) => {
            const idx = state.progressNodes.findIndex((n) => n.id === id);
            if (idx < 0) throw new Error('Node not found');
            state.progressNodes[idx] = {
              ...state.progressNodes[idx],
              ...input,
              updated_at: nowISO(),
            };
            persist();
            return state.progressNodes[idx];
          },
          delete: async (id: string) => {
            state.progressNodes = state.progressNodes.filter(
              (n) => n.id !== id && n.parent_branch_id !== id,
            );
            persist();
          },
        },
        codeVersions: {
          list: async (projectId: string) =>
            state.codeVersions.filter((n) => n.project_id === projectId),
          create: async (projectId: string, input: AnyRecord) => {
            const v = {
              id: uuid(),
              project_id: projectId,
              branch: input?.branch ?? 'main',
              commit_hash: input?.commit_hash ?? '',
              message: input?.message ?? '',
              created_at: nowISO(),
            };
            state.codeVersions.push(v);
            persist();
            return v;
          },
          update: async (id: string, input: AnyRecord) => {
            const idx = state.codeVersions.findIndex((n) => n.id === id);
            if (idx < 0) return null;
            state.codeVersions[idx] = { ...state.codeVersions[idx], ...input };
            persist();
            return state.codeVersions[idx];
          },
        },
        experiments: {
          list: async (projectId: string) =>
            state.experiments.filter((n) => n.project_id === projectId),
          create: async (projectId: string, input: AnyRecord) => {
            const v = {
              id: uuid(),
              project_id: projectId,
              name: input?.name ?? 'Experiment',
              config: input?.config ?? {},
              result: input?.result ?? null,
              created_at: nowISO(),
            };
            state.experiments.push(v);
            persist();
            return v;
          },
          update: async (id: string, input: AnyRecord) => {
            const idx = state.experiments.findIndex((n) => n.id === id);
            if (idx < 0) return null;
            state.experiments[idx] = { ...state.experiments[idx], ...input };
            persist();
            return state.experiments[idx];
          },
        },
        latexVersions: {
          list: async (projectId: string) =>
            state.latexVersions.filter((n) => n.project_id === projectId),
          create: async (projectId: string, input: AnyRecord) => {
            const v = {
              id: uuid(),
              project_id: projectId,
              version: input?.version ?? 'v1',
              content: input?.content ?? '',
              created_at: nowISO(),
            };
            state.latexVersions.push(v);
            persist();
            return v;
          },
        },
        emails: {
          list: async (projectId: string) =>
            state.emails.filter((n) => n.project_id === projectId),
          create: async (projectId: string, input: AnyRecord) => {
            const v = {
              id: uuid(),
              project_id: projectId,
              subject: input?.subject ?? '(no subject)',
              from: input?.from ?? '',
              type: input?.type ?? 'other',
              summary: input?.summary ?? '',
              raw_content: input?.raw_content ?? '',
              received_at: nowISO(),
            };
            state.emails.push(v);
            persist();
            return v;
          },
          update: async (id: string, input: AnyRecord) => {
            const idx = state.emails.findIndex((n) => n.id === id);
            if (idx < 0) return null;
            state.emails[idx] = { ...state.emails[idx], ...input };
            persist();
            return state.emails[idx];
          },
        },
        llmConfig: {
          get: async () => state.llmConfig,
          update: async (input: AnyRecord) => {
            state.llmConfig = { ...(state.llmConfig ?? {}), ...input };
            persist();
            return state.llmConfig;
          },
        },
        emailConfig: {
          get: async () => state.emailConfig,
          save: async (input: AnyRecord) => {
            state.emailConfig = { ...(state.emailConfig ?? {}), ...input };
            persist();
            return state.emailConfig;
          },
          delete: async () => {
            state.emailConfig = null;
            persist();
          },
        },
        gitConfig: {
          get: async () => state.gitConfig,
          save: async (input: AnyRecord) => {
            state.gitConfig = { ...(state.gitConfig ?? {}), ...input };
            persist();
            return state.gitConfig;
          },
        },
        appConfig: {
          get: async () => ({ ...state.appConfig }),
          save: async (input: AnyRecord) => {
            state.appConfig = { ...state.appConfig, ...input };
            persist();
            return state.appConfig;
          },
        },
      },
      git: {
        getStatus: async () => ({ branch: 'main', ahead: 0, behind: 0, modified: [] }),
        getDiff: async () => '',
        getCommits: async () => [],
      },
      email: {
        connect: async () => true,
        fetch: async () => [],
        classify: async () => ({ type: 'other', summary: '' }),
        testConnection: async () => true,
      },
      llm: {
        summarize: async () => '',
        classifyEmail: async () => ({ type: 'other', summary: '' }),
        testConnection: async () => true,
      },
      dialog: {
        saveFile: async () => null,
        openDirectory: async () => null,
        writeFile: async () => undefined,
      },
      latex: {
        // In browser dev mode there's no real LaTeX engine — surface that
        // honestly so the UI shows the "install engine" path.
        getEngineStatus: async () => ({ installed: false, version: null, binaryPath: null }),
        ensureEngine: async () => {
          throw new Error('LaTeX 引擎无法在浏览器开发模式下安装，请在 Electron 中运行');
        },
        compile: async () => {
          throw new Error('LaTeX 编译需要 Electron 环境，请在桌面端运行');
        },
        compileProject: async () => {
          throw new Error('LaTeX 编译需要 Electron 环境，请在桌面端运行');
        },
        onEngineProgress: () => () => undefined,
        onCompileLog: () => () => undefined,
        // File management — mock implementations for browser dev mode
        getStoragePath: async () => ({ path: '/mock/latex-projects', isCustom: false }),
        setStoragePath: async (path: string | null) => ({ path: path ?? '/mock/latex-projects', isCustom: path !== null }),
        importZip: async () => ({ files: [], mainFile: null }),
        listFiles: async () => ({ files: [], mainFile: null }),
        readFile: async () => '',
        writeFile: async () => undefined,
        deleteFile: async () => undefined,
        createFile: async () => undefined,
        renameFile: async () => undefined,
        getMainFile: async () => null,
        setMainFile: async () => undefined,
        getFilePath: () => '',
      },
      window: {
        minimize: () => undefined,
        maximize: () => undefined,
        close: () => undefined,
        isMaximized: async () => false,
        onMaximizeChange: () => () => undefined,
      },
    };

    // Expose reset helper for dev console
    (window as any).__paperpilotResetMock = resetMockDB;
    // eslint-disable-next-line no-console
    console.info(
      '%c[PaperPilot mock]%c Running in browser — using localStorage-backed mock data. ' +
        'Call window.__paperpilotResetMock() to clear.',
      'color:#7c5cff;font-weight:bold',
      'color:inherit',
    );
  }
}
