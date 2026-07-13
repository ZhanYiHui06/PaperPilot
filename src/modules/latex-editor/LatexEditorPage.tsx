import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Button, Empty, toast } from '@lobehub/ui';
import { AlertTriangle, PanelLeftClose, PanelLeftOpen, RotateCcw, Save, FileWarning } from 'lucide-react';
import { useTheme } from 'antd-style';
import { useParams } from 'react-router-dom';
import { useLatexEngineStore } from '@renderer/stores/latexEngineStore';
import { FileViewer } from './FileViewer';
import type { FileViewerHandle, FileKind } from './FileViewer';
import { getFileKind } from './FileViewer';
import { VersionDropdown } from './VersionDropdown';
import { EditorToolbar } from './EditorToolbar';
import { PreviewPanel } from './PreviewPanel';
import type { CompilePhase } from './PreviewPanel';
import { SaveVersionModal } from './SaveVersionModal';
import { FileTreePanel } from './FileTreePanel';
import { useLatexEditorStore } from './store';
import { pageVariants } from '@renderer/lib/motion';
import type { LatexFileNode, LatexEngineType } from '@shared/types';

function LatexEditorPageComp(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const theme = useTheme();

  const editorRef = useRef<FileViewerHandle>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  const versions = useLatexEditorStore((s) => s.versions);
  const selectedVersionId = useLatexEditorStore((s) => s.selectedVersionId);
  const editorContent = useLatexEditorStore((s) => s.editorContent);
  const loading = useLatexEditorStore((s) => s.loading);
  const saving = useLatexEditorStore((s) => s.saving);
  const error = useLatexEditorStore((s) => s.error);

  const loadVersions = useLatexEditorStore((s) => s.loadVersions);
  const selectVersion = useLatexEditorStore((s) => s.selectVersion);
  const setEditorContent = useLatexEditorStore((s) => s.setEditorContent);

  const projectId = id ?? '';

  // ---- File management state ----
  const [files, setFiles] = useState<LatexFileNode[]>([]);
  const [mainFile, setMainFile] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [activeFileKind, setActiveFileKind] = useState<FileKind>('text');
  const [binaryContent, setBinaryContent] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileDirty, setFileDirty] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileTreeCollapsed, setFileTreeCollapsed] = useState(false);

  // ---- LaTeX engine state (global — persists across page navigations) ----
  const engineStatus = useLatexEngineStore((s) => s.engineStatus);
  const engineInstalling = useLatexEngineStore((s) => s.engineInstalling);
  const engineProgress = useLatexEngineStore((s) => s.engineProgress);
  const engineError = useLatexEngineStore((s) => s.engineError);
  const installEngine = useLatexEngineStore((s) => s.installEngine);

  // Selected engine type — loaded from config; 'tectonic' by default.
  // System engines (pdflatex/xelatex/lualatex) don't require Tectonic to be installed.
  const [engineType, setEngineType] = useState<LatexEngineType>('tectonic');
  useEffect(() => {
    void window.api.latex
      .getEngineConfig()
      .then(setEngineType)
      .catch(() => {
        // best-effort — default to 'tectonic'
      });
  }, []);

  // ---- Compile state (local — per-page, not persisted) ----
  const [compilePhase, setCompilePhase] = useState<CompilePhase>('idle');
  const [compileLog, setCompileLog] = useState('');
  const [compileErrors, setCompileErrors] = useState<string[]>([]);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [errorAnalysis, setErrorAnalysis] = useState('');
  const [analyzingError, setAnalyzingError] = useState(false);

  // Subscribe to compile log stream while compiling.
  useEffect(() => {
    if (compilePhase !== 'compiling') return;
    const unsubscribe = window.api.latex.onCompileLog((entry) => {
      setCompileLog((prev) => prev + entry.text);
    });
    return unsubscribe;
  }, [compilePhase]);

  useEffect(() => {
    if (!projectId) return;
    void loadVersions(projectId);
  }, [projectId, loadVersions]);

  // ---- Load file content (text or binary) ----
  const loadFileContent = useCallback(
    async (filePath: string): Promise<void> => {
      if (!projectId) return;
      const kind = getFileKind(filePath);
      setActiveFileKind(kind);
      setFileLoading(true);
      setBinaryContent(null);
      // Clear text content immediately for non-text files to avoid stale display
      if (kind !== 'text') {
        setEditorContent('');
      }
      try {
        if (kind === 'text') {
          const content = await window.api.latex.readFile(projectId, filePath);
          setEditorContent(content);
        } else {
          // PDF, image, or other binary file
          const base64 = await window.api.latex.readBinaryFile(projectId, filePath);
          setBinaryContent(base64);
        }
        setFileDirty(false);
      } catch (e) {
        toast.error({ title: '打开文件失败', description: (e as Error).message });
      } finally {
        setFileLoading(false);
      }
    },
    [projectId, setEditorContent],
  );

  // ---- File tree loading ----
  const refreshFiles = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await window.api.latex.listFiles(projectId);
      setFiles(result.files);
      setMainFile(result.mainFile);
      // Auto-select main file (or first .tex file) if nothing active
      if (!activeFile && result.mainFile) {
        setActiveFile(result.mainFile);
        await loadFileContent(result.mainFile);
      } else if (!activeFile && result.files.length > 0) {
        const firstTex = findFirstTexFile(result.files);
        if (firstTex) {
          setActiveFile(firstTex);
          await loadFileContent(firstTex);
        }
      }
    } catch {
      // File management is best-effort in browser dev mode
    }
  }, [projectId, activeFile, loadFileContent]);

  useEffect(() => {
    void refreshFiles();
  }, [refreshFiles]);

  // ---- File operations ----
  const handleFileSelect = useCallback(
    async (filePath: string) => {
      if (!projectId) return;
      // Auto-save previous file if dirty (only for text files)
      if (fileDirty && activeFile && activeFileKind === 'text') {
        try {
          await window.api.latex.writeFile(projectId, activeFile, editorContent);
          setFileDirty(false);
        } catch (e) {
          toast.error({ title: '自动保存失败', description: (e as Error).message });
        }
      }
      setActiveFile(filePath);
      await loadFileContent(filePath);
    },
    [projectId, fileDirty, activeFile, activeFileKind, editorContent, loadFileContent],
  );

  const handleImportZip = useCallback(
    async (zipPath: string) => {
      if (!projectId) return;
      setImporting(true);
      try {
        const result = await window.api.latex.importZip(projectId, zipPath);
        setFiles(result.files);
        setMainFile(result.mainFile);
        // Load main file into editor
        if (result.mainFile) {
          setActiveFile(result.mainFile);
          await loadFileContent(result.mainFile);
        }
        toast.success({
          title: '模板导入成功',
          description: result.mainFile ? `主文件: ${result.mainFile}` : '未找到 .tex 文件',
        });
      } catch (e) {
        toast.error({ title: '导入失败', description: (e as Error).message });
      } finally {
        setImporting(false);
      }
    },
    [projectId, loadFileContent],
  );

  const handleSaveFile = useCallback(async () => {
    if (!projectId || !activeFile) {
      toast.info({ title: '没有可保存的文件', description: '请先选择或导入一个文件' });
      return;
    }
    if (activeFileKind !== 'text') {
      toast.info({ title: '无法保存', description: '仅支持编辑文本文件' });
      return;
    }
    try {
      await window.api.latex.writeFile(projectId, activeFile, editorContent);
      setFileDirty(false);
      toast.success({ title: '已保存', description: activeFile });
    } catch (e) {
      toast.error({ title: '保存失败', description: (e as Error).message });
    }
  }, [projectId, activeFile, activeFileKind, editorContent]);

  // Track editor content changes for dirty state
  const handleEditorChange = (value: string): void => {
    setEditorContent(value);
    setFileDirty(true);
  };

  // Ctrl+S / Cmd+S to save file
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void handleSaveFile();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSaveFile]);

  // Ask LLM to analyze a failed compile log and surface the likely root cause.
  const analyzeCompileError = useCallback(
    async (log: string) => {
      if (!log.trim()) return;
      setAnalyzingError(true);
      setErrorAnalysis('');
      try {
        const analysis = await window.api.llm.summarize('latex_error', log);
        if (analysis.trim()) {
          setErrorAnalysis(analysis.trim());
        }
      } catch {
        // LLM analysis is best-effort — silently skip on failure
      } finally {
        setAnalyzingError(false);
      }
    },
    [],
  );

  const runCompile = useCallback(async () => {
    if (!projectId) return;

    // Auto-save before compile if there's an active text file
    if (fileDirty && activeFile && activeFileKind === 'text') {
      try {
        await window.api.latex.writeFile(projectId, activeFile, editorContent);
        setFileDirty(false);
      } catch (e) {
        toast.error({ title: '编译前自动保存失败', description: (e as Error).message });
        return;
      }
    }

    // Reset compile state for a fresh run.
    setCompilePhase('compiling');
    setCompileLog('');
    setCompileErrors([]);
    setPdfBase64(null);
    setErrorAnalysis('');
    setAnalyzingError(false);
    try {
      // Prefer project-based compilation when files exist on disk
      let result;
      const projectHasFiles = files.length > 0 || mainFile !== null;
      if (projectHasFiles && mainFile) {
        result = await window.api.latex.compileProject(projectId, mainFile);
      } else {
        if (!editorContent.trim()) {
          toast.warning({ title: '编辑器内容为空', description: '请先导入 LaTeX 模板或输入内容' });
          setCompilePhase('idle');
          return;
        }
        result = await window.api.latex.compile(editorContent);
      }
      // Always sync the final log from the result (covers any tail missed by stream).
      setCompileLog(result.log);
      if (result.success && result.pdfBase64) {
        setPdfBase64(result.pdfBase64);
        setCompileErrors([]);
        setCompilePhase('success');
        toast.success({ title: '编译成功' });
      } else {
        setCompileErrors(result.errors);
        setCompilePhase('error');
        if (result.errors.length === 0) {
          toast.error({ title: '编译失败', description: '请查看日志了解详情' });
        } else {
          toast.error({ title: '编译失败', description: result.errors[0] });
        }
        // Ask LLM to analyze the failure reason
        void analyzeCompileError(result.log);
      }
    } catch (e) {
      const msg = (e as Error).message;
      setCompileErrors([msg]);
      setCompilePhase('error');
      toast.error({ title: '编译失败', description: msg });
      // Analyze the exception message as well
      void analyzeCompileError(msg);
    }
  }, [projectId, fileDirty, activeFile, activeFileKind, editorContent, files, mainFile, analyzeCompileError]);

  const handleCompile = (): void => {
    // Only block compilation when using Tectonic and it's not installed.
    // System engines (pdflatex/xelatex/lualatex) are validated in the main process.
    if (engineType === 'tectonic' && engineStatus?.installed !== true) {
      toast.info({ title: '请先安装 LaTeX 引擎' });
      return;
    }
    void runCompile();
  };

  const handleInstallEngine = useCallback(async () => {
    try {
      await installEngine();
      const status = useLatexEngineStore.getState().engineStatus;
      toast.success({ title: 'Tectonic 引擎安装完成', description: `版本 ${status?.version ?? ''}` });
    } catch (e) {
      toast.error({ title: '引擎安装失败', description: (e as Error).message });
    }
  }, [installEngine]);

  const handleSaveVersion = (): void => {
    if (!projectId) {
      toast.error({ title: '缺少项目 ID，无法保存' });
      return;
    }
    if (!editorContent.trim()) {
      toast.warning({ title: '编辑器内容为空', description: '请先输入 LaTeX 内容' });
      return;
    }
    setSaveModalOpen(true);
  };

  const handleVersionChange = (versionId: string): void => {
    selectVersion(versionId);
  };

  const handleRetry = (): void => {
    if (projectId) void loadVersions(projectId);
  };

  if (!projectId) {
    return (
      <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
        <Empty title="参数错误" description="未提供项目 ID" type="page" />
      </div>
    );
  }

  if (loading && versions.length === 0) {
    return null;
  }

  // Active file display name (last path segment)
  const activeFileName = activeFile ? activeFile.split('/').pop() : null;

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: theme.colorBgLayout,
      }}
    >
      <EditorToolbar
        onCompile={handleCompile}
        onSave={() => void handleSaveFile()}
        onSaveVersion={handleSaveVersion}
        saving={saving}
        compiling={compilePhase === 'compiling' || engineInstalling || importing}
        versionSelector={
          <VersionDropdown
            versions={versions}
            selectedId={selectedVersionId}
            loading={loading}
            onChange={handleVersionChange}
          />
        }
      />

      {/* Error banner (non-blocking — editor still usable) */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: theme.colorWarningBg,
            borderBottom: `1px solid ${theme.colorWarningBorder}`,
            color: theme.colorWarningText,
            fontSize: 13,
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={14} />
          <span style={{ flex: 1 }}>{error}</span>
          <Button size="small" icon={<RotateCcw size={14} />} onClick={handleRetry}>
            重试
          </Button>
        </div>
      )}

      {/* Split view — FileTree | Editor | Preview */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 12 }}>
        {/* File tree panel — collapsible with width animation */}
        <motion.div
          animate={{
            width: fileTreeCollapsed ? 0 : 240,
            opacity: fileTreeCollapsed ? 0 : 1,
          }}
          transition={{
            width: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
            opacity: { duration: fileTreeCollapsed ? 0.1 : 0.15, ease: [0.4, 0, 0.2, 1] },
          }}
          style={{ flexShrink: 0, overflow: 'hidden', willChange: 'width, opacity' }}
        >
          <div
            style={{
              width: 240,
              border: `1px solid ${theme.colorBorderSecondary}`,
              borderRadius: 8,
              overflow: 'hidden',
              background: theme.colorBgContainer,
            }}
          >
            <FileTreePanel
              projectId={projectId}
              files={files}
              mainFile={mainFile}
              activeFile={activeFile}
              onFileSelect={(p) => void handleFileSelect(p)}
              onRefresh={() => void refreshFiles()}
              onImportZip={handleImportZip}
            />
          </div>
        </motion.div>

        {/* Editor + Preview columns */}
        <div style={{ flex: 1, display: 'flex', gap: 12, minWidth: 0 }}>
          {/* Editor column */}
          <div
            style={{
              flex: '1 1 0%',
              minWidth: 0,
              border: `1px solid ${theme.colorBorderSecondary}`,
              borderRadius: 8,
              overflow: 'hidden',
              background: theme.colorBgContainer,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Editor header: collapse toggle + active file path + dirty indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 12px',
                height: 40,
                boxSizing: 'border-box',
                borderBottom: `1px solid ${theme.colorBorderSecondary}`,
                fontSize: 12,
                color: theme.colorTextSecondary,
                flexShrink: 0,
                background: theme.colorBgContainer,
              }}
            >
              <button
                onClick={() => setFileTreeCollapsed((v) => !v)}
                title={fileTreeCollapsed ? '展开文件树' : '收起文件树'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  borderRadius: 4,
                  color: theme.colorTextSecondary,
                  flexShrink: 0,
                  marginLeft: -4,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = theme.colorFillTertiary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {fileTreeCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
              </button>
              {activeFile ? (
                <>
                  <span style={{ fontWeight: 500, color: theme.colorText }}>
                    {activeFileName}
                  </span>
                  {activeFileKind !== 'text' && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: theme.colorFillSecondary,
                        color: theme.colorTextSecondary,
                      }}
                    >
                      只读
                    </span>
                  )}
                  {fileDirty && activeFileKind === 'text' && (
                    <span
                      style={{
                        color: theme.colorWarning,
                        fontSize: 14,
                        lineHeight: 1,
                        marginLeft: 2,
                      }}
                      title="未保存的修改"
                    >
                      ●
                    </span>
                  )}
                </>
              ) : (
                <>
                  <FileWarning size={12} />
                  <span>未打开文件 — 请从左侧文件树选择或导入 LaTeX 模板</span>
                </>
              )}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <FileViewer
                ref={editorRef}
                filePath={activeFile}
                fileKind={activeFileKind}
                textContent={editorContent}
                binaryContent={binaryContent}
                loading={fileLoading}
                onChange={handleEditorChange}
              />
            </div>
          </div>

          {/* Preview column */}
          <div
            style={{
              flex: '1 1 0%',
              minWidth: 0,
              border: `1px solid ${theme.colorBorderSecondary}`,
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <PreviewPanel
              engineStatus={engineStatus}
              engineType={engineType}
              engineInstalling={engineInstalling}
              engineProgress={engineProgress}
              engineError={engineError}
              compilePhase={compilePhase}
              compileLog={compileLog}
              compileErrors={compileErrors}
              pdfBase64={pdfBase64}
              errorAnalysis={errorAnalysis}
              analyzingError={analyzingError}
              onInstallEngine={() => void handleInstallEngine()}
              onRetryCompile={() => void runCompile()}
            />
          </div>
        </div>
      </div>

      <SaveVersionModal
        projectId={projectId}
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
      />
    </motion.div>
  );
}

// Helper: find the first .tex file in the tree (depth-first)
function findFirstTexFile(nodes: LatexFileNode[]): string | null {
  for (const node of nodes) {
    if (node.type === 'file' && node.name.toLowerCase().endsWith('.tex')) {
      return node.path;
    }
    if (node.type === 'directory' && node.children) {
      const found = findFirstTexFile(node.children);
      if (found) return found;
    }
  }
  return null;
}

export const LatexEditorPage = memo(LatexEditorPageComp);
