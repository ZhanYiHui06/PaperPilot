import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider, ConfigProvider, ToastHost } from '@lobehub/ui';
import { LazyMotion, domAnimation } from 'motion/react';
import * as m from 'motion/react-m';
import { injectApiMockIfMissing } from './lib/apiMock';
import { useUIStore } from './stores/uiStore';
import './index.css';

// Dev-only: mock window.api for non-Electron browser preview (e.g., TRAE built-in browser)
injectApiMockIfMissing();

/**
 * Wraps @lobehub/ui ThemeProvider so the `appearance` prop reactively tracks
 * the persisted theme mode stored in uiStore. On first mount, it hydrates the
 * store from the DB-backed app config so the user's last choice is restored.
 */
function AppThemeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const themeMode = useUIStore((s) => s.themeMode);
  const setThemeMode = useUIStore((s) => s.setThemeMode);
  const setThemeModeLoaded = useUIStore((s) => s.setThemeModeLoaded);

  // Hydrate persisted theme from DB once on startup.
  useEffect(() => {
    let cancelled = false;
    window.api.db.appConfig
      .get()
      .then((config) => {
        if (cancelled) return;
        if (config?.theme === 'dark' || config?.theme === 'light') {
          setThemeMode(config.theme);
        }
        setThemeModeLoaded(true);
      })
      .catch(() => {
        setThemeModeLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [setThemeMode, setThemeModeLoaded]);

  const isDark = themeMode === 'dark';

  // Mirror the active mode to the root element so global CSS (scrollbars,
  // modal dividers, sidebar hover states) can react without inline tokens.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  return (
    <ThemeProvider
      appearance={themeMode}
      defaultAppearance="light"
      theme={{
        token: {
          borderRadius: 8,
          borderRadiusLG: 12,
          // Light: near-black primary (Apple/Vercel style).
          // Dark:  white primary so buttons/text remain legible on dark surfaces.
          colorPrimary: isDark ? '#ffffff' : '#171717',
          colorBgLayout: isDark ? '#0a0a0a' : '#fafafa',
          fontFamily:
            '"OPPO Sans 4.0", "OPPO Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        },
        components: {
          Layout: {
            headerBg: isDark ? '#0a0a0a' : '#ffffff',
            siderBg: isDark ? '#0a0a0a' : '#ffffff',
            bodyBg: isDark ? '#0a0a0a' : '#fafafa',
          },
          Card: {
            colorBgContainer: isDark ? '#161616' : '#ffffff',
          },
          Modal: {
            contentBg: isDark ? '#161616' : '#ffffff',
            headerBg: isDark ? '#161616' : '#ffffff',
          },
          // In dark mode the primary color is white — primary buttons must keep
          // dark text so the label stays readable on a white background.
          Button: {
            primaryColor: isDark ? '#0a0a0a' : '#ffffff',
          },
          // Strengthen Segmented selected-item contrast in dark mode.
          Segmented: {
            itemSelectedBg: isDark ? 'rgba(255,255,255,0.15)' : '#ffffff',
            itemSelectedColor: isDark ? '#ffffff' : 'rgba(0,0,0,0.88)',
          },
        },
      }}
    >
      {children}
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LazyMotion features={domAnimation}>
      <ConfigProvider motion={m}>
        <AppThemeProvider>
          <HashRouter>
            <App />
          </HashRouter>
          <ToastHost />
        </AppThemeProvider>
      </ConfigProvider>
    </LazyMotion>
  </React.StrictMode>,
);
