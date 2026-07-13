import { create } from 'zustand';
import type { Project, CreateProjectInput } from '@shared/types';

interface ProjectState {
  projects: Project[];
  archivedProjects: Project[];
  currentProject: Project | null;
  loading: boolean;
  archivedLoading: boolean;
  error: string | null;
  searchQuery: string;

  fetchProjects: () => Promise<void>;
  fetchArchivedProjects: () => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  setSearchQuery: (query: string) => void;
  createProject: (input: CreateProjectInput) => Promise<Project>;
  updateProject: (id: string, input: Partial<Project>) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  archiveProject: (id: string) => Promise<void>;
  restoreProject: (id: string) => Promise<void>;
  getProject: (id: string) => Promise<Project | null>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  archivedProjects: [],
  currentProject: null,
  loading: false,
  archivedLoading: false,
  error: null,
  searchQuery: '',

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await window.api.db.projects.list();
      set({ projects, loading: false });
    } catch (e) {
      const error = e as Error;
      set({ error: error.message, loading: false });
    }
  },

  fetchArchivedProjects: async () => {
    set({ archivedLoading: true, error: null });
    try {
      const archivedProjects = await window.api.db.projects.listArchived();
      set({ archivedProjects, archivedLoading: false });
    } catch (e) {
      const error = e as Error;
      set({ error: error.message, archivedLoading: false });
    }
  },

  setCurrentProject: (project) => set({ currentProject: project }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  createProject: async (input) => {
    const project = await window.api.db.projects.create(input);
    set({ projects: [project, ...get().projects] });
    return project;
  },

  updateProject: async (id, input) => {
    const updated = await window.api.db.projects.update(id, input);
    set({
      projects: get().projects.map((p) => (p.id === id ? updated : p)),
      currentProject: get().currentProject?.id === id ? updated : get().currentProject,
    });
    return updated;
  },

  deleteProject: async (id) => {
    await window.api.db.projects.delete(id);
    set({
      projects: get().projects.filter((p) => p.id !== id),
      archivedProjects: get().archivedProjects.filter((p) => p.id !== id),
    });
  },

  archiveProject: async (id) => {
    const archived = await window.api.db.projects.archive(id);
    const removed = get().projects.find((p) => p.id === id) ?? null;
    set({
      projects: get().projects.filter((p) => p.id !== id),
      archivedProjects: removed ? [removed, ...get().archivedProjects] : get().archivedProjects,
    });
    void archived;
  },

  restoreProject: async (id) => {
    await window.api.db.projects.restore(id);
    const restored = get().archivedProjects.find((p) => p.id === id) ?? null;
    set({
      archivedProjects: get().archivedProjects.filter((p) => p.id !== id),
      projects: restored ? [restored, ...get().projects] : get().projects,
    });
  },

  getProject: async (id) => {
    try {
      const project = await window.api.db.projects.get(id);
      if (project) {
        set({ currentProject: project });
      }
      return project;
    } catch (e) {
      const error = e as Error;
      set({ error: error.message });
      return null;
    }
  },
}));
