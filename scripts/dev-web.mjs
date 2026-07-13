// Dev script: start Vite renderer only — no Electron, no main/preload build.
// Run: npm run dev:web
// Open http://localhost:5173 in TRAE built-in browser (or any browser).
// Mock data is provided by src/lib/apiMock.ts (localStorage-backed).

import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const server = await createServer({
    root: resolve(__dirname, '..', 'src'),
    configFile: false,
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, '..', 'src'),
        '@shared': resolve(__dirname, '..', 'shared'),
      },
    },
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
    },
  });

  await server.listen();
  server.printUrls();

  // eslint-disable-next-line no-console
  console.log('\n[dev:web] Running renderer only — no Electron window.');
  console.log('[dev:web] Open http://localhost:5173 in your browser.');
  console.log('[dev:web] Mock data persists in localStorage. Reset via window.__paperpilotResetMock().\n');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
