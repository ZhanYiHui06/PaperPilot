import { create } from 'zustand';
import type { LatexVersion } from '@shared/types';

interface LatexEditorState {
  versions: LatexVersion[];
  selectedVersionId: string | null;
  editorContent: string;
  loading: boolean;
  saving: boolean;
  error: string | null;

  loadVersions: (projectId: string) => Promise<void>;
  selectVersion: (id: string | null) => void;
  setEditorContent: (content: string) => void;
  saveVersion: (
    projectId: string,
    versionLabel: string,
    editorContent: string,
  ) => Promise<LatexVersion>;
}

export const useLatexEditorStore = create<LatexEditorState>((set, get) => ({
  versions: [],
  selectedVersionId: null,
  editorContent: '',
  loading: false,
  saving: false,
  error: null,

  loadVersions: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const list = await window.api.db.latexVersions.list(projectId);
      // Newest first (timestamp descending)
      const sorted = [...list].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      set({ versions: sorted, loading: false });
      // Auto-select newest if nothing currently selected
      if (!get().selectedVersionId && sorted.length > 0) {
        set({ selectedVersionId: sorted[0].id });
      } else if (
        get().selectedVersionId &&
        !sorted.some((v) => v.id === get().selectedVersionId)
      ) {
        // Selected version no longer exists — reset to newest (or null)
        set({ selectedVersionId: sorted[0]?.id ?? null });
      }
    } catch (e) {
      const error = e as Error;
      set({ error: error.message, loading: false });
    }
  },

  selectVersion: (id) => set({ selectedVersionId: id }),

  setEditorContent: (content) => set({ editorContent: content }),

  saveVersion: async (projectId, versionLabel, content) => {
    set({ saving: true, error: null });
    try {
      // Generate AI summary of the editor content first
      let aiSummary: string | null = null;
      try {
        aiSummary = await window.api.llm.summarize('latex', content);
      } catch {
        // Non-fatal: persist version without summary if LLM call fails
        aiSummary = null;
      }

      const created = await window.api.db.latexVersions.create({
        project_id: projectId,
        version_label: versionLabel,
        ai_summary: aiSummary,
      });
      // Insert at head — newest first
      set({
        versions: [created, ...get().versions],
        selectedVersionId: created.id,
        saving: false,
      });
      return created;
    } catch (e) {
      const error = e as Error;
      set({ error: error.message, saving: false });
      throw error;
    }
  },
}));
