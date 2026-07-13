import { memo, useCallback, useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useTheme } from 'antd-style';

export interface FileDropZoneProps {
  /** Called when a file is dropped or selected, with its text content. */
  onFileContent?: (content: string, fileName: string) => void;
  /** Called when multiple files are dropped/selected (only when multiple=true). */
  onFilesContent?: (files: Array<{ name: string; content: string }>) => void;
  /** Accepted file extensions, e.g. '.txt,.log'. Defaults to all. */
  accept?: string;
  /** Whether the drop zone is in a loading state (e.g. LLM parsing). */
  loading?: boolean;
  /** Helper text below the icon. */
  description?: string;
  /** Optional sub-text shown below the description. */
  hint?: string;
  /** Allow selecting/dropping multiple files at once. */
  multiple?: boolean;
}

function FileDropZoneComp({
  onFileContent,
  onFilesContent,
  accept,
  loading = false,
  description = '拖拽文件到此处，或点击选择',
  hint,
  multiple = false,
}: FileDropZoneProps): React.ReactElement {
  const theme = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const readFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        onFileContent?.(reader.result as string, file.name);
      };
      reader.readAsText(file);
    },
    [onFileContent],
  );

  const readMultiple = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      Promise.all(
        fileArray.map(
          (file) =>
            new Promise<{ name: string; content: string }>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => {
                resolve({ name: file.name, content: reader.result as string });
              };
              reader.readAsText(file);
            }),
        ),
      ).then((results) => {
        onFilesContent?.(results);
      });
    },
    [onFilesContent],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (loading) return;
      if (multiple && e.dataTransfer.files.length > 0) {
        readMultiple(e.dataTransfer.files);
      } else {
        const file = e.dataTransfer.files[0];
        if (file) readFile(file);
      }
    },
    [loading, multiple, readFile, readMultiple],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (multiple && e.target.files && e.target.files.length > 0) {
        readMultiple(e.target.files);
      } else {
        const file = e.target.files?.[0];
        if (file) readFile(file);
      }
      // Reset so selecting the same file again still triggers change
      e.target.value = '';
    },
    [multiple, readFile, readMultiple],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!loading) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !loading && inputRef.current?.click()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '24px 16px',
        borderRadius: 8,
        border: `2px dashed ${isDragging ? theme.colorPrimary : theme.colorBorderSecondary}`,
        background: isDragging ? theme.colorPrimaryBg : theme.colorFillQuaternary,
        cursor: loading ? 'default' : 'pointer',
        transition: 'border-color 0.14s ease, background 0.14s ease',
        opacity: loading ? 0.6 : 1,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />
      {loading ? (
        <Loader2 size={24} style={{ color: theme.colorPrimary, animation: 'spin 1s linear infinite' }} />
      ) : (
        <Upload size={24} style={{ color: theme.colorTextTertiary }} />
      )}
      <span style={{ fontSize: 13, color: theme.colorTextSecondary }}>{description}</span>
      {hint && <span style={{ fontSize: 12, color: theme.colorTextTertiary }}>{hint}</span>}
      <style>{'@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

export const FileDropZone = memo(FileDropZoneComp);
