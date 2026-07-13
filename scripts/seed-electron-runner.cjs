/**
 * Electron runner for the seed script.
 * Runs seed-demo-data.mjs using Electron's Node runtime (which matches
 * the compiled better-sqlite3 native module).
 *
 * Usage: npx electron scripts/seed-electron-runner.cjs
 */
const { app } = require('electron');

// Disable GPU and sandbox — we don't need a window
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');

app.whenReady().then(async () => {
  try {
    await import('./seed-demo-data.mjs');
  } catch (err) {
    console.error('Seed script failed:', err);
    process.exit(1);
  }
  // The seed script calls process.exit(0) itself when done.
  // This is a fallback in case it doesn't exit.
  setTimeout(() => {
    app.quit();
    process.exit(0);
  }, 5000);
});
