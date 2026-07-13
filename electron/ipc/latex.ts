import { ipcMain, app, type IpcMainInvokeEvent } from 'electron';
import { join, dirname, basename, resolve } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { spawn, execFile } from 'child_process';
import { randomUUID } from 'crypto';
import * as https from 'https';
import { IPC_CHANNELS } from '../../shared/types';
import type {
  LatexCompileResult,
  LatexEngineStatus,
  LatexEngineProgress,
  LatexEngineInfo,
  LatexEngineType,
} from '../../shared/types';
import { getProjectDir, getEngineConfig } from './latex-files';

// Event channels for streaming progress back to the renderer.
const ENGINE_PROGRESS_EVENT = 'latex:engine-progress';
const COMPILE_LOG_EVENT = 'latex:compile-log';

const ENGINE_DIRNAME = 'tectonic';
const BINARY_NAME = process.platform === 'win32' ? 'tectonic.exe' : 'tectonic';
const WORK_DIRNAME = 'latex-work';

function getEngineDir(): string {
  return join(app.getPath('userData'), ENGINE_DIRNAME);
}

function getBinaryPath(): string {
  return join(getEngineDir(), BINARY_NAME);
}

function getWorkDirRoot(): string {
  return join(app.getPath('userData'), WORK_DIRNAME);
}

interface PlatformAsset {
  pattern: RegExp;
  ext: 'zip' | 'tar.gz';
}

function getPlatformAsset(): PlatformAsset {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === 'win32') {
    return { pattern: /tectonic-[\d.]+-x86_64-pc-windows-msvc\.zip$/, ext: 'zip' };
  }
  if (platform === 'darwin') {
    if (arch === 'arm64') {
      return { pattern: /tectonic-[\d.]+-aarch64-apple-darwin\.tar\.gz$/, ext: 'tar.gz' };
    }
    return { pattern: /tectonic-[\d.]+-x86_64-apple-darwin\.tar\.gz$/, ext: 'tar.gz' };
  }
  return { pattern: /tectonic-[\d.]+-x86_64-unknown-linux-musl\.tar\.gz$/, ext: 'tar.gz' };
}

interface LatestRelease {
  tagName: string;
  assetUrl: string;
  assetName: string;
  ext: 'zip' | 'tar.gz';
}

// --- Network resilience constants -----------------------------------------
// Per-attempt timeout. GitHub downloads from China often hang mid-stream;
// failing fast lets us retry or fall back to a mirror quickly.
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = [1_000, 3_000, 9_000];

// Mirror prefixes tried in order when the direct GitHub URL fails.
// Each prefix is prepended to the full https://github.com/... URL.
// Empty string = direct connection (tried first).
const MIRROR_PREFIXES = [
  '',
  'https://ghproxy.net/',
  'https://gh-proxy.com/',
  'https://ghps.cc/',
];

// Hardcoded fallback if the GitHub API is unreachable. The asset naming
// convention is stable across releases, so we can construct URLs manually.
const FALLBACK_VERSION = '0.15.0';
const FALLBACK_TAGNAME = `v${FALLBACK_VERSION}`;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Retry a promise-returning function with exponential backoff.
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BACKOFF_MS[attempt - 1] ?? 1_000);
      }
    }
  }
  throw new Error(
    `${label} failed after ${MAX_RETRIES} attempts: ${(lastErr as Error).message}`,
  );
}

function fetchJson(
  url: string,
  headers: Record<string, string> = {},
  redirectCount = 0,
): Promise<any> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('Too many redirects'));
      return;
    }
    const req = https.get(
      url,
      {
        headers: { 'User-Agent': 'PaperPilot', Accept: 'application/vnd.github+json', ...headers },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        // Follow 3xx redirects (GitHub API occasionally returns them).
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          fetchJson(res.headers.location, headers, redirectCount + 1).then(resolve, reject);
          return;
        }
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        let body = '';
        res.setEncoding('utf-8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
        res.on('error', reject);
      },
    );
    // Triggered by `timeout` option above — aborts the socket.
    req.on('timeout', () => {
      req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms: ${url}`));
    });
    req.on('error', reject);
  });
}

function buildAssetUrl(version: string): string {
  const { ext } = getPlatformAsset();
  const platform = process.platform;
  const arch = process.arch;
  let assetName: string;
  if (platform === 'win32') {
    assetName = `tectonic-${version}-x86_64-pc-windows-msvc.zip`;
  } else if (platform === 'darwin') {
    assetName =
      arch === 'arm64'
        ? `tectonic-${version}-aarch64-apple-darwin.tar.gz`
        : `tectonic-${version}-x86_64-apple-darwin.tar.gz`;
  } else {
    assetName = `tectonic-${version}-x86_64-unknown-linux-musl.tar.gz`;
  }
  void ext; // ext is derived from assetName's extension; kept for clarity.
  return `https://github.com/tectonic-typesetting/tectonic/releases/download/v${version}/${assetName}`;
}

async function fetchLatestRelease(): Promise<LatestRelease> {
  const { pattern, ext } = getPlatformAsset();
  let tagName = FALLBACK_TAGNAME;
  let assetUrl: string | null = null;
  let assetName: string | null = null;

  // Try the GitHub API first (with retry). If it fails entirely, fall back
  // to a hardcoded version + constructed URL.
  try {
    const data = await withRetry(
      () => fetchJson('https://api.github.com/repos/tectonic-typesetting/tectonic/releases/latest'),
      'GitHub API',
    );
    const asset = (data.assets as Array<{ name: string; browser_download_url: string }>).find((a) =>
      pattern.test(a.name),
    );
    if (asset) {
      tagName = data.tag_name as string;
      assetUrl = asset.browser_download_url;
      assetName = asset.name;
    }
  } catch {
    // Fall through to fallback below.
  }

  if (!assetUrl || !assetName) {
    // Construct from known convention using the fallback version.
    assetUrl = buildAssetUrl(FALLBACK_VERSION);
    // Derive asset name from URL.
    assetName = assetUrl.split('/').pop() ?? `tectonic-${FALLBACK_VERSION}.zip`;
  }

  return { tagName, assetUrl, assetName, ext };
}

// Stream a (possibly redirected) download to a file with progress callbacks.
// Adds per-attempt timeout; caller handles retries / mirror fallback.
function downloadFileOnce(
  url: string,
  destPath: string,
  onProgress: (received: number, total: number | null) => void,
  redirectCount = 0,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('Too many redirects'));
      return;
    }
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'PaperPilot' }, timeout: REQUEST_TIMEOUT_MS },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          downloadFileOnce(res.headers.location, destPath, onProgress, redirectCount + 1)
            .then(resolve, reject);
          return;
        }
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
          return;
        }
        const totalHeader = res.headers['content-length'];
        const total = totalHeader ? parseInt(totalHeader, 10) : null;
        let received = 0;
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          received += chunk.length;
          onProgress(received, total);
        });
        res.on('end', () => {
          try {
            writeFileSync(destPath, Buffer.concat(chunks));
            resolve();
          } catch (e) {
            reject(e);
          }
        });
        res.on('error', reject);
      },
    );
    req.on('timeout', () => {
      req.destroy(new Error(`Download timed out after ${REQUEST_TIMEOUT_MS}ms: ${url}`));
    });
    req.on('error', reject);
  });
}

// Try direct URL first, then mirror prefixes. Each URL gets up to MAX_RETRIES
// attempts with exponential backoff before moving to the next mirror.
async function downloadFileWithMirrors(
  originalUrl: string,
  destPath: string,
  onProgress: (received: number, total: number | null) => void,
  onMirror: (label: string) => void,
): Promise<void> {
  const urls = MIRROR_PREFIXES.map((prefix) => `${prefix}${originalUrl}`);
  let lastErr: unknown;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const label = MIRROR_PREFIXES[i] === '' ? '直连' : new URL(MIRROR_PREFIXES[i]).hostname;
    onMirror(label);
    try {
      await withRetry(
        () => downloadFileOnce(url, destPath, onProgress),
        `Download via ${label}`,
      );
      return; // success
    } catch (e) {
      lastErr = e;
      // Try next mirror.
    }
  }
  throw new Error(
    `All download mirrors failed. Last error: ${(lastErr as Error).message}. ` +
      '请检查网络连接，或手动下载 Tectonic 二进制后放置到: ' +
      getBinaryPath(),
  );
}

function extractArchive(archivePath: string, destDir: string, ext: 'zip' | 'tar.gz'): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ext === 'zip') {
      // Windows: use built-in PowerShell Expand-Archive (no extra deps).
      const ps = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force`,
      ]);
      let stderr = '';
      ps.stderr.on('data', (d) => (stderr += d.toString()));
      ps.on('error', reject);
      ps.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`PowerShell Expand-Archive failed (exit ${code}): ${stderr}`));
      });
    } else {
      // macOS/Linux: rely on system tar.
      execFile('tar', ['-xzf', archivePath, '-C', destDir], (err, _stdout, stderr) => {
        if (err) reject(new Error(`tar extraction failed: ${err.message}\n${stderr}`));
        else resolve();
      });
    }
  });
}

// Locate the actual binary inside the extracted directory (it may be nested).
function findBinaryRecursive(dir: string): string | null {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isFile() && entry.name === BINARY_NAME) {
      return fullPath;
    }
    if (entry.isDirectory()) {
      const found = findBinaryRecursive(fullPath);
      if (found) return found;
    }
  }
  return null;
}

function getBinaryVersion(binaryPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(binaryPath, ['--version'], (err, stdout) => {
      if (err) {
        resolve(null);
        return;
      }
      // Tectonic prints: tectonic 0.15.0
      const match = stdout.match(/tectonic\s+(\S+)/i);
      resolve(match ? match[1] : stdout.trim());
    });
  });
}

function getEngineStatusSync(): LatexEngineStatus {
  const binaryPath = getBinaryPath();
  if (!existsSync(binaryPath)) {
    return { installed: false, version: null, binaryPath: null };
  }
  // Version check is async — return installed=true with placeholder; caller
  // can request version separately if needed. We avoid blocking the sync
  // status call on a subprocess.
  return { installed: true, version: 'unknown', binaryPath };
}

async function ensureTectonic(
  event: IpcMainInvokeEvent,
): Promise<LatexEngineStatus> {
  const send = (p: LatexEngineProgress): void => {
    event.sender.send(ENGINE_PROGRESS_EVENT, p);
  };

  const binaryPath = getBinaryPath();
  if (existsSync(binaryPath)) {
    const version = await getBinaryVersion(binaryPath);
    send({ stage: 'done', message: 'Tectonic 已就绪' });
    return { installed: true, version: version ?? 'unknown', binaryPath };
  }

  const engineDir = getEngineDir();
  if (!existsSync(engineDir)) {
    mkdirSync(engineDir, { recursive: true });
  }

  // 1. Fetch latest release info.
  send({ stage: 'download', message: '正在查询最新版本…' });
  const release = await fetchLatestRelease();
  send({
    stage: 'download',
    message: `发现版本 ${release.tagName}，开始下载 ${release.assetName}（失败将自动重试并切换镜像）`,
  });

  // 2. Download the archive to a temp location inside engineDir.
  //    Tries direct GitHub first, then falls back to mirror proxies.
  const archivePath = join(engineDir, release.assetName);
  await downloadFileWithMirrors(
    release.assetUrl,
    archivePath,
    (received, total) => {
      const percent = total ? Math.round((received / total) * 100) : undefined;
      send({
        stage: 'download',
        message: total
          ? `下载中 ${formatBytes(received)} / ${formatBytes(total)}`
          : `下载中 ${formatBytes(received)}`,
        percent,
      });
    },
    (mirrorLabel) => {
      send({
        stage: 'download',
        message: `正在通过 ${mirrorLabel} 下载…`,
      });
    },
  );

  // 3. Extract into a temporary sibling directory.
  send({ stage: 'extract', message: '正在解压…' });
  const extractDir = join(engineDir, `extract-${randomUUID()}`);
  if (!existsSync(extractDir)) mkdirSync(extractDir, { recursive: true });
  await extractArchive(archivePath, extractDir, release.ext);

  // 4. Locate the binary and move it to the canonical path.
  const found = findBinaryRecursive(extractDir);
  if (!found) {
    throw new Error('Downloaded archive did not contain a tectonic binary');
  }
  // Move via copy then delete (rename across dirs may fail on Windows).
  const fs = await import('fs/promises');
  await fs.copyFile(found, binaryPath);
  // Best-effort cleanup of extraction artifacts.
  try {
    rmSync(extractDir, { recursive: true, force: true });
    rmSync(archivePath, { force: true });
  } catch {
    // Non-fatal.
  }

  // 5. On Unix, ensure the binary is executable.
  if (process.platform !== 'win32') {
    await fs.chmod(binaryPath, 0o755);
  }

  // 6. Verify by reading version.
  send({ stage: 'verify', message: '正在验证安装…' });
  const version = await getBinaryVersion(binaryPath);
  if (!version) {
    throw new Error('Tectonic binary installed but failed to report its version');
  }

  send({ stage: 'done', message: `Tectonic ${version} 安装完成` });
  return { installed: true, version, binaryPath };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Parse the Tectonic log for human-readable error lines.
function extractErrors(log: string): string[] {
  const errors: string[] = [];
  const lines = log.split(/\r?\n/);
  for (const line of lines) {
    // TeX-style error markers: "! ..." lines.
    if (/^!\s/.test(line)) {
      errors.push(line.trim());
    }
  }
  return errors;
}

// --- System TeX engine detection ------------------------------------------
// Checks whether pdflatex / xelatex / lualatex are available on PATH.
// Tectonic is bundled and tracked separately via getEngineStatusSync.

const SYSTEM_ENGINE_BINARIES: Record<Exclude<LatexEngineType, 'tectonic'>, string> = {
  pdflatex: 'pdflatex',
  xelatex: 'xelatex',
  lualatex: 'lualatex',
};

const ENGINE_LABELS: Record<LatexEngineType, string> = {
  tectonic: 'Tectonic (内置)',
  pdflatex: 'pdfLaTeX (系统)',
  xelatex: 'XeLaTeX (系统)',
  lualatex: 'LuaLaTeX (系统)',
};

function checkBinaryOnPath(binaryName: string): Promise<{ available: boolean; version: string | null; path: string | null }> {
  return new Promise((resolve) => {
    // `which` on Unix, `where` on Windows. Using `--version` to get the version string.
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    execFile(cmd, [binaryName], (err, stdout) => {
      if (err) {
        resolve({ available: false, version: null, path: null });
        return;
      }
      const path = stdout.split(/\r?\n/)[0].trim() || null;
      // Now get version
      execFile(binaryName, ['--version'], (vErr, vStdout) => {
        if (vErr) {
          resolve({ available: true, version: null, path });
          return;
        }
        // Version is usually on the first line, e.g. "pdfTeX 3.141592653-2.6-1.40.24 (TeX Live 2022)"
        const firstLine = vStdout.split(/\r?\n/)[0].trim();
        resolve({ available: true, version: firstLine, path });
      });
    });
  });
}

async function detectSystemEngines(): Promise<LatexEngineInfo[]> {
  const results: LatexEngineInfo[] = [];
  for (const [name, binary] of Object.entries(SYSTEM_ENGINE_BINARIES)) {
    const engineName = name as LatexEngineType;
    const info = await checkBinaryOnPath(binary);
    results.push({
      name: engineName,
      label: ENGINE_LABELS[engineName],
      available: info.available,
      version: info.version,
      path: info.path,
    });
  }
  return results;
}

// --- System engine compilation --------------------------------------------
// Runs pdflatex/xelatex/lualatex from a local TeX distribution.
// Multiple passes are needed to resolve cross-references, TOC, etc.
// Tectonic handles this automatically; system engines do not.

const COMPILE_PASSES = 3; // standard practice for cross-references + bibliography

async function compileWithSystemEngine(
  event: IpcMainInvokeEvent,
  engine: Exclude<LatexEngineType, 'tectonic'>,
  projectDir: string,
  mainFile: string,
): Promise<LatexCompileResult> {
  const binary = SYSTEM_ENGINE_BINARIES[engine];
  const outputName = basename(mainFile).replace(/\.tex$/i, '.pdf');
  // Set cwd to the directory containing the main .tex file so that pdflatex
  // can find .sty/.cls/.bib files in the same directory (e.g. AAAI templates).
  const srcDir = resolve(projectDir, dirname(mainFile));
  const mainFileName = basename(mainFile);
  // Use an absolute path for output directory to avoid issues with cwd change.
  const outDir = resolve(projectDir, '.build');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const args = [
    '-interaction=nonstopmode',
    '-halt-on-error',
    '-no-shell-escape',
    `-output-directory=${outDir}`,
    mainFileName,
  ];

  let lastStdout = '';
  let lastStderr = '';

  for (let pass = 1; pass <= COMPILE_PASSES; pass++) {
    event.sender.send(COMPILE_LOG_EVENT, {
      stream: 'stdout',
      text: `\n[Pass ${pass}/${COMPILE_PASSES}] Running ${binary}...\n`,
    });

    const passResult = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
      const proc = spawn(binary, args, {
        cwd: srcDir,
        env: { ...process.env },
      });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stdout += text;
        event.sender.send(COMPILE_LOG_EVENT, { stream: 'stdout', text });
      });
      proc.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderr += text;
        event.sender.send(COMPILE_LOG_EVENT, { stream: 'stderr', text });
      });
      proc.on('error', (err) => {
        reject(new Error(`无法启动 ${binary}：${err.message}。请确认已安装 TeX 发行版（如 TeX Live / MiKTeX）并加入 PATH。`));
      });
      proc.on('close', (code) => {
        resolve({ stdout, stderr, code });
      });
    });

    lastStdout = passResult.stdout;
    lastStderr = passResult.stderr;

    // If a pass fails catastrophically (e.g. binary not found, syntax error),
    // stop early — further passes won't help.
    if (passResult.code === null) {
      break;
    }

    // After first pass, run bibtex if the .aux file contains citations.
    if (pass === 1) {
      const auxPath = join(outDir, mainFileName.replace(/\.tex$/i, '.aux'));
      if (existsSync(auxPath)) {
        const auxContent = readFileSync(auxPath, 'utf-8');
        const needsBibtex = /\\citation|\\bibdata|\\bibstyle/.test(auxContent);
        if (needsBibtex) {
          event.sender.send(COMPILE_LOG_EVENT, {
            stream: 'stdout',
            text: `\n[Pass 1/${COMPILE_PASSES}] Running bibtex...\n`,
          });

          const bibtexResult = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
            const bibtexProc = spawn('bibtex', [mainFileName.replace(/\.tex$/i, '')], {
              cwd: outDir,
              env: {
                ...process.env,
                // Let bibtex find .bib files in the source directory.
                BIBINPUTS: `${srcDir};`,
                BSTINPUTS: `${srcDir};`,
              },
            });
            let btStdout = '';
            let btStderr = '';
            bibtexProc.stdout.on('data', (chunk: Buffer) => {
              const text = chunk.toString();
              btStdout += text;
              event.sender.send(COMPILE_LOG_EVENT, { stream: 'stdout', text });
            });
            bibtexProc.stderr.on('data', (chunk: Buffer) => {
              const text = chunk.toString();
              btStderr += text;
              event.sender.send(COMPILE_LOG_EVENT, { stream: 'stderr', text });
            });
            bibtexProc.on('error', () => {
              // bibtex not installed — warn but continue.
              event.sender.send(COMPILE_LOG_EVENT, {
                stream: 'stderr',
                text: 'Warning: bibtex not found, skipping bibliography step.\n',
              });
              resolve({ stdout: '', stderr: '', code: 0 });
            });
            bibtexProc.on('close', (code) => {
              resolve({ stdout: btStdout, stderr: btStderr, code });
            });
          });

          lastStdout += bibtexResult.stdout;
          lastStderr += bibtexResult.stderr;
        }
      }
    }
  }

  const log = lastStdout + (lastStderr ? `\n--- stderr ---\n${lastStderr}` : '');
  // The PDF is written to outDir with the same base name as the main file.
  const pdfPath = join(outDir, outputName);

  if (existsSync(pdfPath)) {
    // Check if the log indicates success (no "Fatal error" or undefined references).
    const hasFatalError = /Fatal error|! Emergency stop|! Undefined control sequence/.test(log);
    if (!hasFatalError) {
      try {
        const pdfBuffer = readFileSync(pdfPath);
        const pdfBase64 = pdfBuffer.toString('base64');
        return {
          success: true,
          pdfBase64,
          log,
          errors: [],
          outputName,
        };
      } catch (e) {
        throw e as Error;
      }
    }
  }

  return {
    success: false,
    log,
    errors: extractErrors(log),
    outputName,
  };
}

async function compileLatex(
  event: IpcMainInvokeEvent,
  source: string,
): Promise<LatexCompileResult> {
  const binaryPath = getBinaryPath();
  if (!existsSync(binaryPath)) {
    throw new Error('Tectonic 引擎尚未安装，请先点击「安装引擎」');
  }

  const workRoot = getWorkDirRoot();
  if (!existsSync(workRoot)) mkdirSync(workRoot, { recursive: true });

  // Use a per-compile isolated directory to avoid file collisions.
  const sessionDir = join(workRoot, randomUUID());
  mkdirSync(sessionDir, { recursive: true });
  const texPath = join(sessionDir, 'main.tex');
  writeFileSync(texPath, source, 'utf-8');

  // Tectonic args:
  //   --outdir <dir>      place outputs here
  //   --keep-logs         keep .log file
  //   --keep-intermediates keep .aux etc (helps debugging)
  //   --print             print log to stdout
  //   main.tex            input file
  const args = [
    '--outdir',
    sessionDir,
    '--keep-logs',
    '--keep-intermediates',
    '--print',
    texPath,
  ];

  return await new Promise<LatexCompileResult>((resolve, reject) => {
    const proc = spawn(binaryPath, args, {
      cwd: sessionDir,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      event.sender.send(COMPILE_LOG_EVENT, { stream: 'stdout', text });
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      event.sender.send(COMPILE_LOG_EVENT, { stream: 'stderr', text });
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn tectonic: ${err.message}`));
    });

    proc.on('close', (code) => {
      const log = stdout + (stderr ? `\n--- stderr ---\n${stderr}` : '');
      const pdfPath = join(sessionDir, 'main.pdf');

      if (code === 0 && existsSync(pdfPath)) {
        try {
          const pdfBuffer = readFileSync(pdfPath);
          const pdfBase64 = pdfBuffer.toString('base64');
          resolve({
            success: true,
            pdfBase64,
            log,
            errors: [],
            outputName: 'main.pdf',
          });
        } catch (e) {
          reject(e as Error);
        }
        return;
      }

      // Compilation failed — return structured error so the renderer can show logs.
      resolve({
        success: false,
        log,
        errors: extractErrors(log),
        outputName: 'main.pdf',
      });
    });
  });
}

// Compile a LaTeX project from its directory on disk.
// `projectId` is resolved to the project's storage directory.
// `mainFile` is the relative path to the main .tex file (e.g. "main.tex").
// Dispatches to the Tectonic engine or a system TeX engine based on config.
async function compileProject(
  event: IpcMainInvokeEvent,
  projectId: string,
  mainFileRaw: string,
): Promise<LatexCompileResult> {
  // Normalize the main file path — strip any leading slashes that may have
  // been introduced by older versions of the file-tree builder.
  const mainFile = mainFileRaw.replace(/^[/\\]+/, '');
  const projectDir = getProjectDir(projectId);
  const texPath = join(projectDir, mainFile);
  if (!existsSync(texPath)) {
    throw new Error(`主文件不存在: ${mainFile}`);
  }

  const engine = getEngineConfig();

  // System engines (pdflatex / xelatex / lualatex) — require a local TeX distribution.
  if (engine !== 'tectonic') {
    return compileWithSystemEngine(event, engine, projectDir, mainFile);
  }

  // Tectonic (default, bundled).
  const binaryPath = getBinaryPath();
  if (!existsSync(binaryPath)) {
    throw new Error('Tectonic 引擎尚未安装，请先点击「安装引擎」');
  }

  const outputName = mainFile.replace(/\.tex$/i, '.pdf');

  // Tectonic args:
  //   --outdir <dir>      place outputs in the project dir
  //   --keep-logs         keep .log file
  //   --keep-intermediates keep .aux etc
  //   --print             print log to stdout
  //   <mainFile>          input file (relative to cwd)
  const args = [
    '--outdir',
    projectDir,
    '--keep-logs',
    '--keep-intermediates',
    '--print',
    mainFile,
  ];

  return await new Promise<LatexCompileResult>((resolve, reject) => {
    const proc = spawn(binaryPath, args, {
      cwd: projectDir,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      event.sender.send(COMPILE_LOG_EVENT, { stream: 'stdout', text });
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      event.sender.send(COMPILE_LOG_EVENT, { stream: 'stderr', text });
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn tectonic: ${err.message}`));
    });

    proc.on('close', (code) => {
      const log = stdout + (stderr ? `\n--- stderr ---\n${stderr}` : '');
      const pdfPath = join(projectDir, outputName);

      if (code === 0 && existsSync(pdfPath)) {
        try {
          const pdfBuffer = readFileSync(pdfPath);
          const pdfBase64 = pdfBuffer.toString('base64');
          resolve({
            success: true,
            pdfBase64,
            log,
            errors: [],
            outputName,
          });
        } catch (e) {
          reject(e as Error);
        }
        return;
      }

      resolve({
        success: false,
        log,
        errors: extractErrors(log),
        outputName,
      });
    });
  });
}

export function registerLatexIpc(): void {
  ipcMain.handle(IPC_CHANNELS.LATEX_GET_ENGINE_STATUS, async (): Promise<LatexEngineStatus> => {
    const status = getEngineStatusSync();
    if (status.installed) {
      const version = await getBinaryVersion(status.binaryPath);
      return { installed: true, version: version ?? 'unknown', binaryPath: status.binaryPath };
    }
    return status;
  });

  ipcMain.handle(
    IPC_CHANNELS.LATEX_ENSURE_ENGINE,
    async (e: IpcMainInvokeEvent): Promise<LatexEngineStatus> => {
      return ensureTectonic(e);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.LATEX_COMPILE,
    async (e: IpcMainInvokeEvent, source: string): Promise<LatexCompileResult> => {
      return compileLatex(e, source);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.LATEX_COMPILE_PROJECT,
    async (
      e: IpcMainInvokeEvent,
      projectId: string,
      mainFile: string,
    ): Promise<LatexCompileResult> => {
      return compileProject(e, projectId, mainFile);
    },
  );

  // Detect system TeX engines (pdflatex / xelatex / lualatex) on PATH.
  ipcMain.handle(
    IPC_CHANNELS.LATEX_DETECT_SYSTEM_ENGINES,
    async (): Promise<LatexEngineInfo[]> => {
      return detectSystemEngines();
    },
  );
}
