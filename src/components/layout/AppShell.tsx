import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts';
import { memo, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { useLatexEngineStore } from '@renderer/stores/latexEngineStore';

function usePageKey(): string {
  const location = useLocation();
  return useMemo(() => {
    if (location.pathname.startsWith('/project/')) return 'dashboard';
    if (location.pathname.startsWith('/settings')) return 'settings';
    if (location.pathname.startsWith('/archive')) return 'archive';
    if (location.pathname.startsWith('/about')) return 'about';
    return 'home';
  }, [location.pathname]);
}

/** Pages that own their own header/content entrance animation — skip shell float-up. */
const SELF_ANIMATED_PAGES = new Set(['dashboard', 'settings', 'archive', 'about']);

function AppShellComp(): React.ReactElement {
  const pageKey = usePageKey();
  const selfAnimated = SELF_ANIMATED_PAGES.has(pageKey);
  useKeyboardShortcuts();

  // Initialize global LaTeX engine store — subscribes to progress events
  // once for the entire app lifetime so downloads persist across page switches
  const initEngine = useLatexEngineStore((s) => s.init);
  useEffect(() => {
    initEngine();
  }, [initEngine]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {/*
         * Simple fade-in on page key change — no AnimatePresence/exit animation.
         * AnimatePresence + Outlet causes flicker because Outlet content updates
         * before the exit animation can capture the old content.
         * key change remounts the div, fading in cleanly.
         *
         * settings / archive / about animate header+content themselves
         * (header down, content up), so shell must not apply y translation.
         */}
        <motion.div
          key={pageKey}
          initial={{
            opacity: selfAnimated ? 1 : 0,
            y: selfAnimated ? 0 : 20,
          }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            y: { type: 'spring', stiffness: 260, damping: 26, mass: 0.8 },
            opacity: { duration: selfAnimated ? 0 : 0.2, ease: [0.4, 0, 0.2, 1] },
          }}
          style={{ height: '100%' }}
        >
          <Outlet />
        </motion.div>
      </div>
    </div>
  );
}

export const AppShell = memo(AppShellComp);
