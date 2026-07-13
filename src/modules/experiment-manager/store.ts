import { create } from 'zustand';
import type { Experiment } from '@shared/types';

export type ExperimentViewMode = 'table' | 'card';

interface ExperimentState {
  experiments: Experiment[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  viewMode: ExperimentViewMode;

  loadExperiments: (projectId: string) => Promise<void>;
  selectExperiment: (id: string | null) => void;
  addExperiment: (input: Partial<Experiment>) => Promise<Experiment>;
  updateExperiment: (id: string, input: Partial<Experiment>) => Promise<Experiment>;
  setViewMode: (mode: ExperimentViewMode) => void;
}

export const useExperimentStore = create<ExperimentState>((set, get) => ({
  experiments: [],
  selectedId: null,
  loading: false,
  error: null,
  viewMode: 'table',

  loadExperiments: async (projectId: string): Promise<void> => {
    set({ loading: true, error: null });
    try {
      const experiments = await window.api.db.experiments.list(projectId);
      set({ experiments, loading: false });
    } catch (e) {
      const error = e as Error;
      set({ error: error.message, loading: false });
    }
  },

  selectExperiment: (id) => set({ selectedId: id }),

  addExperiment: async (input) => {
    try {
      const created = await window.api.db.experiments.create(input);
      set({ experiments: [created, ...get().experiments], error: null });
      return created;
    } catch (e) {
      // Re-throw so the calling component can surface a toast; do NOT set
      // page-level error state — a create failure should not blank the list.
      throw e;
    }
  },

  updateExperiment: async (id, input) => {
    try {
      const updated = await window.api.db.experiments.update(id, input);
      set({
        experiments: get().experiments.map((e) => (e.id === id ? updated : e)),
        error: null,
      });
      return updated;
    } catch (e) {
      // Re-throw so the calling component can surface a toast.
      throw e;
    }
  },

  setViewMode: (mode) => set({ viewMode: mode }),
}));
