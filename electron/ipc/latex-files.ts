import { ipcMain, app, type IpcMainInvokeEvent } from 'electron';
import { join, dirname, extname, relative } from 'path';
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  renameSync,
} from 'fs';
import { spawn, execFile } from 'child_process';
import { IPC_CHANNELS } from '../../shared/types';
import type { LatexFileNode, LatexEngineType } from '../../shared/types';

// --- Config ---------------------------------------------------------------

const CONFIG_FILE = 'latex-config.json';
const DEFAULT_STORAGE_DIRNAME = 'latex-projects';
const PROJECT_CONFIG_FILE = '.paperpilot.json';

interface LatexConfig {
  storagePath: string | null; // null = use default
  engine: LatexEngineType; // default 'tectonic'
}

interface ProjectConfig {
  mainFile: string | null; // relative path, e.g. "main.tex"
}

function getConfigPath(): string {
  return join(app.getPath('userData'), CONFIG_FILE);
}

function loadConfig(): LatexConfig {
  const p = getConfigPath();
  if (existsSync(p)) {
    try {
      const cfg = JSON.parse(readFileSync(p, 'utf-8')) as Partial<LatexConfig>;
      return {
        storagePath: cfg.storagePath ?? null,
        engine: cfg.engine ?? 'tectonic',
      };
    } catch {
      // fall through to default
    }
  }
  return { storagePath: null, engine: 'tectonic' };
}

function saveConfig(config: LatexConfig): void {
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

function getStoragePath(): string {
  const config = loadConfig();
  if (config.storagePath && existsSync(config.storagePath)) {
    return config.storagePath;
  }
  return join(app.getPath('userData'), DEFAULT_STORAGE_DIRNAME);
}

// Exported so latex.ts can resolve project directories for compileProject.
export function getProjectDir(projectId: string): string {
  const dir = join(getStoragePath(), projectId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Exported so latex.ts can read which engine to use for compilation.
export function getEngineConfig(): LatexEngineType {
  return loadConfig().engine;
}

export function setEngineConfig(engine: LatexEngineType): void {
  const config = loadConfig();
  config.engine = engine;
  saveConfig(config);
}

function getProjectConfigPath(projectId: string): string {
  return join(getProjectDir(projectId), PROJECT_CONFIG_FILE);
}

function loadProjectConfig(projectId: string): ProjectConfig {
  const p = getProjectConfigPath(projectId);
  if (existsSync(p)) {
    try {
      const config = JSON.parse(readFileSync(p, 'utf-8')) as ProjectConfig;
      // Normalize main file path — strip leading slashes from older versions
      if (config.mainFile) {
        config.mainFile = config.mainFile.replace(/^[/\\]+/, '');
      }
      return config;
    } catch {
      // fall through
    }
  }
  return { mainFile: null };
}

function saveProjectConfig(projectId: string, config: ProjectConfig): void {
  writeFileSync(getProjectConfigPath(projectId), JSON.stringify(config, null, 2), 'utf-8');
}

// --- File tree ------------------------------------------------------------

function buildFileTree(dir: string, relativeTo: string, mainFile: string | null): LatexFileNode[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: LatexFileNode[] = [];
  for (const entry of entries) {
    // Skip hidden files, config files, and OS junk
    if (entry.name.startsWith('.')) continue;
    if (entry.name === '__MACOSX') continue;
    if (entry.name === 'Thumbs.db') continue;
    if (entry.name === 'desktop.ini') continue;

    const fullPath = join(dir, entry.name);
    // Use path.relative() to get a clean relative path without leading slash.
    // The old substring() approach produced paths like "/file.tex" which broke
    // Tectonic (it interpreted the leading "/" as an absolute path root).
    const relativePath = relative(relativeTo, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      const children = buildFileTree(fullPath, relativeTo, mainFile);
      // Only include non-empty directories
      if (children.length > 0) {
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: 'directory',
          children,
        });
      }
    } else {
      // Skip common LaTeX output files
      const ext = extname(entry.name).toLowerCase();
      if (['.aux', '.log', '.out', '.toc', '.bbl', '.blg', '.fls', '.fdb_latexmk', '.synctex.gz'].includes(ext)) {
        continue;
      }
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: 'file',
        isMain: mainFile === relativePath,
      });
    }
  }

  // Sort: directories first, then files, alphabetically
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

// --- Zip extraction -------------------------------------------------------

function extractZip(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.platform === 'win32') {
      const ps = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`,
      ]);
      let stderr = '';
      ps.stderr.on('data', (d) => (stderr += d.toString()));
      ps.on('error', reject);
      ps.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`PowerShell Expand-Archive failed (exit ${code}): ${stderr}`));
      });
    } else {
      // macOS/Linux: try unzip first, fall back to tar
      execFile('unzip', ['-o', zipPath, '-d', destDir], (err) => {
        if (err) {
          execFile('tar', ['-xf', zipPath, '-C', destDir], (err2) => {
            if (err2) reject(new Error(`Extraction failed: ${err2.message}`));
            else resolve();
          });
        } else {
          resolve();
        }
      });
    }
  });
}

// --- Main file auto-detection --------------------------------------------

// Search for .tex files containing \documentclass to identify the main file.
function findMainTexFile(dir: string): string | null {
  const texFiles: Array<{ relativePath: string; content: string }> = [];

  function collectTexFiles(d: string, relativeTo: string): void {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = join(d, entry.name);
      const relativePath = relative(relativeTo, fullPath).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        collectTexFiles(fullPath, relativeTo);
      } else if (entry.name.toLowerCase().endsWith('.tex')) {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          texFiles.push({ relativePath, content });
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  collectTexFiles(dir, dir);

  // Priority 1: files named main.tex or ms.tex
  const namedMain = texFiles.find((f) => {
    const name = f.relativePath.split('/').pop()?.toLowerCase();
    return name === 'main.tex' || name === 'ms.tex';
  });
  if (namedMain) return namedMain.relativePath;

  // Priority 2: files containing \documentclass
  const withDocClass = texFiles.find((f) => /\\documentclass/.test(f.content));
  if (withDocClass) return withDocClass.relativePath;

  // Priority 3: first .tex file
  if (texFiles.length > 0) return texFiles[0].relativePath;

  return null;
}

// --- IPC handlers ---------------------------------------------------------

export function registerLatexFileIpc(): void {
  // Get the current LaTeX storage path (custom or default)
  ipcMain.handle(IPC_CHANNELS.LATEX_GET_STORAGE_PATH, async (): Promise<{ path: string; isCustom: boolean }> => {
    const config = loadConfig();
    return {
      path: getStoragePath(),
      isCustom: config.storagePath !== null,
    };
  });

  // Set a custom LaTeX storage path
  ipcMain.handle(
    IPC_CHANNELS.LATEX_SET_STORAGE_PATH,
    async (_e: IpcMainInvokeEvent, path: string | null): Promise<{ path: string; isCustom: boolean }> => {
      const config = loadConfig();
      config.storagePath = path;
      saveConfig(config);
      return { path: getStoragePath(), isCustom: path !== null };
    },
  );

  // Get the currently selected LaTeX compiler engine
  ipcMain.handle(IPC_CHANNELS.LATEX_GET_ENGINE_CONFIG, async (): Promise<LatexEngineType> => {
    return getEngineConfig();
  });

  // Set the LaTeX compiler engine
  ipcMain.handle(
    IPC_CHANNELS.LATEX_SET_ENGINE_CONFIG,
    async (_e: IpcMainInvokeEvent, engine: LatexEngineType): Promise<LatexEngineType> => {
      setEngineConfig(engine);
      return engine;
    },
  );

  // Import a zip file into the project directory
  ipcMain.handle(
    IPC_CHANNELS.LATEX_IMPORT_ZIP,
    async (_e: IpcMainInvokeEvent, projectId: string, zipPath: string): Promise<{ files: LatexFileNode[]; mainFile: string | null }> => {
      if (!existsSync(zipPath)) {
        throw new Error(`压缩包文件不存在: ${zipPath}`);
      }
      const projectDir = getProjectDir(projectId);
      await extractZip(zipPath, projectDir);

      // Auto-detect main file
      let mainFile = findMainTexFile(projectDir);
      const config = loadProjectConfig(projectId);
      if (mainFile) {
        config.mainFile = mainFile;
        saveProjectConfig(projectId, config);
      } else {
        mainFile = config.mainFile;
      }

      const files = buildFileTree(projectDir, projectDir, mainFile);
      return { files, mainFile };
    },
  );

  // List all files in a project directory as a tree
  ipcMain.handle(
    IPC_CHANNELS.LATEX_LIST_FILES,
    async (_e: IpcMainInvokeEvent, projectId: string): Promise<{ files: LatexFileNode[]; mainFile: string | null }> => {
      const projectDir = getProjectDir(projectId);
      const config = loadProjectConfig(projectId);
      const files = buildFileTree(projectDir, projectDir, config.mainFile);
      return { files, mainFile: config.mainFile };
    },
  );

  // Read a text file from the project directory
  ipcMain.handle(
    IPC_CHANNELS.LATEX_READ_FILE,
    async (_e: IpcMainInvokeEvent, projectId: string, filePath: string): Promise<string> => {
      const projectDir = getProjectDir(projectId);
      const fullPath = join(projectDir, filePath);
      if (!existsSync(fullPath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }
      return readFileSync(fullPath, 'utf-8');
    },
  );

  // Read a binary file as base64 (for PDF, images, etc.)
  ipcMain.handle(
    IPC_CHANNELS.LATEX_READ_BINARY_FILE,
    async (_e: IpcMainInvokeEvent, projectId: string, filePath: string): Promise<string> => {
      const projectDir = getProjectDir(projectId);
      const fullPath = join(projectDir, filePath);
      if (!existsSync(fullPath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }
      const buffer = readFileSync(fullPath);
      return buffer.toString('base64');
    },
  );

  // Write content to a file in the project directory
  ipcMain.handle(
    IPC_CHANNELS.LATEX_WRITE_FILE,
    async (_e: IpcMainInvokeEvent, projectId: string, filePath: string, content: string): Promise<void> => {
      const projectDir = getProjectDir(projectId);
      const fullPath = join(projectDir, filePath);
      const dir = dirname(fullPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(fullPath, content, 'utf-8');
    },
  );

  // Delete a file or directory from the project
  ipcMain.handle(
    IPC_CHANNELS.LATEX_DELETE_FILE,
    async (_e: IpcMainInvokeEvent, projectId: string, filePath: string): Promise<void> => {
      const projectDir = getProjectDir(projectId);
      const fullPath = join(projectDir, filePath);
      if (!existsSync(fullPath)) return;
      rmSync(fullPath, { recursive: true, force: true });

      // Clear main file if it was deleted
      const config = loadProjectConfig(projectId);
      if (config.mainFile === filePath) {
        config.mainFile = null;
        saveProjectConfig(projectId, config);
      }
    },
  );

  // Create a new file or directory
  ipcMain.handle(
    IPC_CHANNELS.LATEX_CREATE_FILE,
    async (_e: IpcMainInvokeEvent, projectId: string, filePath: string, isDirectory: boolean): Promise<void> => {
      const projectDir = getProjectDir(projectId);
      const fullPath = join(projectDir, filePath);
      if (existsSync(fullPath)) {
        throw new Error(`文件已存在: ${filePath}`);
      }
      if (isDirectory) {
        mkdirSync(fullPath, { recursive: true });
      } else {
        const dir = dirname(fullPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(fullPath, '', 'utf-8');
      }
    },
  );

  // Rename/move a file or directory
  ipcMain.handle(
    IPC_CHANNELS.LATEX_RENAME_FILE,
    async (_e: IpcMainInvokeEvent, projectId: string, oldPath: string, newPath: string): Promise<void> => {
      const projectDir = getProjectDir(projectId);
      const fullOld = join(projectDir, oldPath);
      const fullNew = join(projectDir, newPath);
      if (!existsSync(fullOld)) {
        throw new Error(`源文件不存在: ${oldPath}`);
      }
      const dir = dirname(fullNew);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      renameSync(fullOld, fullNew);

      // Update main file if it was renamed
      const config = loadProjectConfig(projectId);
      if (config.mainFile === oldPath) {
        config.mainFile = newPath;
        saveProjectConfig(projectId, config);
      }
    },
  );

  // Get the main file path for a project
  ipcMain.handle(
    IPC_CHANNELS.LATEX_GET_MAIN_FILE,
    async (_e: IpcMainInvokeEvent, projectId: string): Promise<string | null> => {
      return loadProjectConfig(projectId).mainFile;
    },
  );

  // Set the main file for a project
  ipcMain.handle(
    IPC_CHANNELS.LATEX_SET_MAIN_FILE,
    async (_e: IpcMainInvokeEvent, projectId: string, filePath: string): Promise<void> => {
      const config = loadProjectConfig(projectId);
      config.mainFile = filePath;
      saveProjectConfig(projectId, config);
    },
  );
}
