import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve('electron'),
        '@db': resolve('database'),
        '@shared': resolve('shared'),
      },
    },
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: {
          index: resolve('electron/index.ts'),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: {
          index: resolve('electron/preload.ts'),
        },
      },
    },
  },
  renderer: {
    root: 'src',
    resolve: {
      alias: {
        '@renderer': resolve('src'),
        '@shared': resolve('shared'),
      },
    },
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: {
          index: resolve('src/index.html'),
        },
      },
    },
    plugins: [react()],
    server: {
      port: 5173,
    },
  },
});
