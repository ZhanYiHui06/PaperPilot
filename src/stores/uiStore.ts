import { create } from 'zustand';

type ThemeMode = 'light' | 'dark';

interface UIState {
  createModalOpen: boolean;
  sidebarCollapsed: boolean;
  /** Current theme appearance applied to the whole app. */
  themeMode: ThemeMode;
  /** Whether the persisted theme config has been loaded from DB. */
  themeModeLoaded: boolean;

  setCreateModalOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setThemeModeLoaded: (loaded: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  createModalOpen: false,
  sidebarCollapsed: false,
  themeMode: 'light',
  themeModeLoaded: false,

  setCreateModalOpen: (open) => set({ createModalOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setThemeMode: (mode) => set({ themeMode: mode }),
  setThemeModeLoaded: (loaded) => set({ themeModeLoaded: loaded }),
}));
