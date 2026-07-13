import { memo, forwardRef, useImperativeHandle, useRef } from 'react';
import { useTheme } from 'antd-style';
import { FileQuestion, Loader2 } from 'lucide-react';
import { LatexCodeMirror } from './LatexCodeMirror';
import type { LatexCodeMirrorHandle } from './LatexCodeMirror';

export type FileKind = 'text' | 'pdf' | 'image' | 'binary';

interface FileViewerProps {
  filePath: string | null;
  fileKind: FileKind;
  textContent: string;
  binaryContent: string | null;
  loading: boolean;
  onChange: (value: string) => void;
}

export type FileViewerHandle = LatexCodeMirrorHandle;

const TEXT_EXTENSIONS = new Set([
  'tex', 'bib', 'sty', 'cls', 'txt', 'md', 'csv', 'json', 'js', 'ts',
  'jsx', 'tsx', 'py', 'sh', 'bat', 'yml', 'yaml', 'xml', 'html', 'css',
  'scss', 'less', 'ini', 'cfg', 'conf', 'log', 'rtf', 'markdown',
]);

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico',
]);

export function getFileKind(filePath: string): FileKind {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (TEXT_EXTENSIONS.has(ext)) return 'text';
  // EPS files are images in LaTeX context
  if (ext === 'eps') return 'image';
  return 'binary';
}

function LoadingOverlay({ message }: { message: string }): React.ReactElement {
  const theme = useTheme();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 12,
        color: theme.colorTextSecondary,
        fontSize: 13,
      }}
    >
      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      <span>{message}</span>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function UnsupportedFile({ ext }: { ext: string }): React.ReactElement {
  const theme = useTheme();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 12,
        color: theme.colorTextSecondary,
        fontSize: 13,
      }}
    >
      <FileQuestion size={32} style={{ opacity: 0.5 }} />
      <span>不支持预览 .{ext} 文件</span>
    </div>
  );
}

function PdfViewer({ base64 }: { base64: string }): React.ReactElement {
  const dataUrl = `data:application/pdf;base64,${base64}`;
  return (
    <iframe
      src={dataUrl}
      title="PDF Preview"
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        display: 'block',
      }}
    />
  );
}

function ImageViewer({ base64, ext }: { base64: string; ext: string }): React.ReactElement {
  const theme = useTheme();
  const mimeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    eps: 'application/postscript',
  };
  const mime = mimeMap[ext] ?? 'image/png';
  const dataUrl = `data:${mime};base64,${base64}`;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme.colorFillQuaternary,
        padding: 16,
      }}
    >
      <img
        src={dataUrl}
        alt="Preview"
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          borderRadius: 4,
          boxShadow: theme.boxShadowTertiary,
        }}
      />
    </div>
  );
}

function FileViewerComp(
  props: FileViewerProps,
  ref: React.Ref<FileViewerHandle>,
): React.ReactElement {
  const { filePath, fileKind, textContent, binaryContent, loading, onChange } = props;
  const theme = useTheme();

  // Expose the CodeMirror handle for text files (for toolbar insert commands)
  const editorRef = useRef<LatexCodeMirrorHandle>(null);
  useImperativeHandle(
    ref,
    (): FileViewerHandle => ({
      insertAtCursor: (text: string) => {
        editorRef.current?.insertAtCursor(text);
      },
      focus: () => {
        editorRef.current?.focus();
      },
    }),
    [],
  );

  if (loading) {
    return <LoadingOverlay message="正在加载文件..." />;
  }

  if (!filePath) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: theme.colorTextTertiary,
          fontSize: 13,
        }}
      >
        请从左侧文件树选择或导入 LaTeX 模板
      </div>
    );
  }

  if (fileKind === 'text') {
    // Use key={filePath} to force remount on file switch — this is the most
    // reliable way to ensure CodeMirror displays the correct content.
    return (
      <LatexCodeMirror
        ref={editorRef}
        key={filePath}
        value={textContent}
        onChange={onChange}
      />
    );
  }

  if (fileKind === 'pdf') {
    if (!binaryContent) return <LoadingOverlay message="正在加载 PDF..." />;
    return <PdfViewer base64={binaryContent} />;
  }

  if (fileKind === 'image') {
    if (!binaryContent) return <LoadingOverlay message="正在加载图片..." />;
    const ext = filePath.split('.').pop()?.toLowerCase() ?? 'png';
    return <ImageViewer base64={binaryContent} ext={ext} />;
  }

  // binary / unsupported
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return <UnsupportedFile ext={ext} />;
}

export const FileViewer = memo(forwardRef(FileViewerComp));
