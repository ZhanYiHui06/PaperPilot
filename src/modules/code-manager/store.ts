import { create } from 'zustand';
import type { CodeVersion, GitCommit, GitStatus } from '@shared/types';

interface CodeManagerState {
  versions: CodeVersion[];
  selectedId: string | null;
  loading: boolean;
  regeneratingId: string | null;
  deletingId: string | null;
  error: string | null;

  // Git-side data (for the Git integration mode indicator)
  gitStatus: GitStatus | null;
  gitCommits: GitCommit[];
  gitRepoPath: string | null;
  gitLoading: boolean;

  loadVersions: (projectId: string) => Promise<void>;
  selectVersion: (id: string | null) => void;
  addVersion: (input: Partial<CodeVersion>) => Promise<CodeVersion>;
  deleteVersion: (id: string) => Promise<void>;
  regenerateSummary: (version: CodeVersion) => Promise<void>;
  detectGitRepo: () => Promise<void>;
}

export const useCodeManagerStore = create<CodeManagerState>((set, get) => ({
  versions: [],
  selectedId: null,
  loading: false,
  regeneratingId: null,
  deletingId: null,
  error: null,

  gitStatus: null,
  gitCommits: [],
  gitRepoPath: null,
  gitLoading: false,

  loadVersions: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const list = await window.api.db.codeVersions.list(projectId);
      // Newest first (timestamp descending)
      const sorted = [...list].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      set({ versions: sorted, loading: false });
      // Auto-select newest if nothing currently selected
      if (!get().selectedId && sorted.length > 0) {
        set({ selectedId: sorted[0].id });
      } else if (get().selectedId && !sorted.some((v) => v.id === get().selectedId)) {
        // Selected version no longer exists — reset
        set({ selectedId: sorted[0]?.id ?? null });
      }
    } catch (e) {
      const error = e as Error;
      set({ error: error.message, loading: false });
    }
  },

  selectVersion: (id) => set({ selectedId: id }),

  addVersion: async (input) => {
    set({ error: null });
    try {
      const created = await window.api.db.codeVersions.create(input);
      // Insert at head — newest first
      set({ versions: [created, ...get().versions], selectedId: created.id });
      return created;
    } catch (e) {
      const error = e as Error;
      set({ error: error.message });
      throw error;
    }
  },

  deleteVersion: async (id) => {
    set({ deletingId: id, error: null });
    try {
      await window.api.db.codeVersions.delete(id);
      const remaining = get().versions.filter((v) => v.id !== id);
      // Reassign selection if the deleted version was selected
      const newSelectedId =
        get().selectedId === id ? (remaining[0]?.id ?? null) : get().selectedId;
      set({ versions: remaining, selectedId: newSelectedId, deletingId: null });
    } catch (e) {
      const error = e as Error;
      set({ error: error.message, deletingId: null });
      throw error;
    }
  },

  regenerateSummary: async (version) => {
    if (!version.diff_text) return;
    set({ regeneratingId: version.id, error: null });
    try {
      const summary = await window.api.llm.summarize('code', version.diff_text);
      // Persist the regenerated summary so it survives restarts.
      await window.api.db.codeVersions.update(version.id, { ai_summary: summary });
      set({
        versions: get().versions.map((v) =>
          v.id === version.id ? { ...v, ai_summary: summary } : v,
        ),
        regeneratingId: null,
      });
    } catch (e) {
      const error = e as Error;
      set({ error: error.message, regeneratingId: null });
    }
  },

  detectGitRepo: async () => {
    set({ gitLoading: true, error: null });
    try {
      const config = await window.api.db.gitConfig.get();
      const repoPath = config?.default_repo_path ?? null;
      if (!repoPath) {
        set({ gitRepoPath: null, gitStatus: null, gitCommits: [], gitLoading: false });
        return;
      }
      set({ gitRepoPath: repoPath });
      // Fetch status and recent commits in parallel — non-fatal if either fails
      try {
        const status = await window.api.git.getStatus(repoPath);
        set({ gitStatus: status });
      } catch {
        set({ gitStatus: null });
      }
      try {
        const commits = await window.api.git.getCommits(repoPath, 20);
        set({ gitCommits: commits });
      } catch {
        set({ gitCommits: [] });
      }
      set({ gitLoading: false });
    } catch (e) {
      const error = e as Error;
      set({ error: error.message, gitLoading: false });
    }
  },
}));
