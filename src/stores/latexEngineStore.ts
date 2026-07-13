import { create } from 'zustand';
import type { LatexEngineProgress, LatexEngineStatus } from '@shared/types';

/**
 * Global LaTeX engine store — persists across page navigations.
 *
 * The engine download runs in the Electron main process via IPC.
 * This store keeps the UI state (installing flag, progress, errors)
 * alive even when the user navigates away from the LaTeX editor page,
 * so returning to the page shows the ongoing download progress.
 */
interface LatexEngineState {
  engineStatus: LatexEngineStatus | null;
  engineInstalling: boolean;
  engineProgress: LatexEngineProgress[];
  engineError: string | null;
  initialized: boolean;

  /** Check engine status and subscribe to progress events. Call once at app startup. */
  init: () => void;
  /** Trigger engine installation (idempotent — no-op if already installing). */
  installEngine: () => Promise<void>;
  /** Refresh engine status from main process. */
  refreshStatus: () => Promise<void>;
}

export const useLatexEngineStore = create<LatexEngineState>((set, get) => ({
  engineStatus: null,
  engineInstalling: false,
  engineProgress: [],
  engineError: null,
  initialized: false,

  init: () => {
    if (get().initialized) return;
    set({ initialized: true });

    // Check current engine status
    void get().refreshStatus();

    // Subscribe to engine progress events globally — this subscription
    // lives for the entire app lifetime, not tied to any page component.
    window.api.latex.onEngineProgress((p) => {
      set((state) => ({ engineProgress: [...state.engineProgress, p] }));
      if (p.stage === 'error') {
        set({ engineError: p.message });
      }
      if (p.stage === 'done') {
        // Engine is ready — refresh status to get the installed flag + version
        void get().refreshStatus();
      }
    });
  },

  refreshStatus: async () => {
    try {
      const status = await window.api.latex.getEngineStatus();
      set({ engineStatus: status });
    } catch {
      // Best-effort — engine status is not critical for rendering
    }
  },

  installEngine: async () => {
    // Prevent duplicate installation requests
    if (get().engineInstalling) return;

    set({ engineInstalling: true, engineError: null, engineProgress: [] });
    try {
      const status = await window.api.latex.ensureEngine();
      set({ engineStatus: status, engineInstalling: false });
    } catch (e) {
      const msg = (e as Error).message;
      set({ engineError: msg, engineInstalling: false });
      throw e;
    }
  },
}));
