import { memo, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { Button, Input, Modal, toast } from '@lobehub/ui';
import {
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileImage,
  File,
  Plus,
  Trash2,
  Pencil,
  Star,
  Upload,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useTheme } from 'antd-style';
import type { LatexFileNode } from '@shared/types';

interface FileTreePanelProps {
  projectId: string;
  files: LatexFileNode[];
  mainFile: string | null;
  activeFile: string | null;
  onFileSelect: (filePath: string) => void;
  onRefresh: () => void;
  onImportZip: (zipPath: string) => void;
}

// Get the appropriate icon for a file based on its extension
function getFileIcon(name: string): React.ReactElement {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'tex') return <FileCode size={14} />;
  if (ext === 'bib') return <FileText size={14} />;
  if (['png', 'jpg', 'jpeg', 'pdf', 'eps'].includes(ext ?? '')) return <FileImage size={14} />;
  return <File size={14} />;
}

interface TreeNodeProps {
  node: LatexFileNode;
  depth: number;
  activeFile: string | null;
  onFileSelect: (path: string) => void;
  onContextMenu: (node: LatexFileNode, e: React.MouseEvent) => void;
}

const TreeNode = memo(function TreeNode({
  node,
  depth,
  activeFile,
  onFileSelect,
  onContextMenu,
}: TreeNodeProps): React.ReactElement | null {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(true);

  const isActive = node.type === 'file' && activeFile === node.path;
  const isMain = node.isMain === true;

  const handleClick = () => {
    if (node.type === 'directory') {
      setExpanded((prev) => !prev);
    } else {
      onFileSelect(node.path);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(node, e);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px',
          paddingLeft: depth * 12 + 8,
          cursor: 'pointer',
          borderRadius: 4,
          fontSize: 13,
          background: isActive ? theme.colorPrimaryBg : 'transparent',
          color: isActive ? theme.colorPrimaryText : theme.colorText,
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = theme.colorFillTertiary;
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = 'transparent';
        }}
      >
        {node.type === 'directory' ? (
          <>
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {expanded ? (
              <FolderOpen size={14} style={{ color: theme.colorTextSecondary, flexShrink: 0 }} />
            ) : (
              <Folder size={14} style={{ color: theme.colorTextSecondary, flexShrink: 0 }} />
            )}
          </>
        ) : (
          <>
            <span style={{ width: 12, flexShrink: 0 }} />
            {getFileIcon(node.name)}
          </>
        )}
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: isMain ? 600 : 400,
          }}
        >
          {node.name}
        </span>
        {isMain && (
          <Star size={11} style={{ flexShrink: 0, color: theme.colorPrimary, marginLeft: 'auto' }} />
        )}
      </motion.div>
      {node.type === 'directory' && expanded && node.children && (
        <>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFile={activeFile}
              onFileSelect={onFileSelect}
              onContextMenu={onContextMenu}
            />
          ))}
        </>
      )}
    </>
  );
});

function FileTreePanelComp(props: FileTreePanelProps): React.ReactElement {
  const { projectId, files, mainFile, activeFile, onFileSelect, onRefresh, onImportZip } = props;
  const theme = useTheme();

  const [newFileModalOpen, setNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileIsDir, setNewFileIsDir] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<LatexFileNode | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<LatexFileNode | null>(null);

  const handleCreate = useCallback(async () => {
    if (!newFileName.trim()) return;
    try {
      await window.api.latex.createFile(projectId, newFileName.trim(), newFileIsDir);
      setNewFileModalOpen(false);
      setNewFileName('');
      onRefresh();
    } catch (e) {
      toast.error({ title: '创建失败', description: (e as Error).message });
    }
  }, [projectId, newFileName, newFileIsDir, onRefresh]);

  const handleRename = useCallback(async () => {
    if (!renameTarget || !renameValue.trim()) return;
    const dir = renameTarget.path.includes('/')
      ? renameTarget.path.substring(0, renameTarget.path.lastIndexOf('/') + 1)
      : '';
    const newPath = dir + renameValue.trim();
    try {
      await window.api.latex.renameFile(projectId, renameTarget.path, newPath);
      setRenameModalOpen(false);
      setRenameTarget(null);
      onRefresh();
    } catch (e) {
      toast.error({ title: '重命名失败', description: (e as Error).message });
    }
  }, [projectId, renameTarget, renameValue, onRefresh]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await window.api.latex.deleteFile(projectId, deleteTarget.path);
      setDeleteTarget(null);
      onRefresh();
    } catch (e) {
      toast.error({ title: '删除失败', description: (e as Error).message });
    }
  }, [projectId, deleteTarget, onRefresh]);

  const handleSetMain = useCallback(
    async (node: LatexFileNode) => {
      if (node.type !== 'file') return;
      try {
        await window.api.latex.setMainFile(projectId, node.path);
        onRefresh();
      } catch (e) {
        toast.error({ title: '设置主文件失败', description: (e as Error).message });
      }
    },
    [projectId, onRefresh],
  );

  const handleContextMenu = useCallback(
    (node: LatexFileNode, _e: React.MouseEvent) => {
      const isTex = node.type === 'file' && node.name.toLowerCase().endsWith('.tex');
      const action = window.prompt(
        `${node.name}\n\n输入操作：\n${isTex ? '1 = 设为主文件\n' : ''}2 = 重命名\n3 = 删除`,
        '2',
      );
      if (action === '1' && isTex) {
        void handleSetMain(node);
      } else if (action === '2') {
        setRenameTarget(node);
        setRenameValue(node.name);
        setRenameModalOpen(true);
      } else if (action === '3') {
        setDeleteTarget(node);
      }
    },
    [handleSetMain],
  );

  const handleNewFile = (isDir: boolean) => {
    setNewFileIsDir(isDir);
    setNewFileName('');
    setNewFileModalOpen(true);
  };

  return (
    <div
      style={{
        width: 240,
        flexShrink: 0,
        background: theme.colorBgContainer,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          height: 40,
          boxSizing: 'border-box',
          borderBottom: `1px solid ${theme.colorBorderSecondary}`,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: theme.colorText }}>文件</span>
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button
            type="text"
            size="small"
            icon={<Plus size={14} />}
            onClick={() => handleNewFile(false)}
            title="新建文件"
          />
          <Button
            type="text"
            size="small"
            icon={<Folder size={14} />}
            onClick={() => handleNewFile(true)}
            title="新建文件夹"
          />
        </div>
      </div>

      {/* File tree or empty state */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 4px' }}>
        {files.length === 0 ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) {
                const zipPath = window.api.latex.getFilePath(file);
                if (zipPath) {
                  onImportZip(zipPath);
                }
              }
            }}
            style={{
              margin: '12px 8px',
              padding: '24px 12px',
              border: `2px dashed ${theme.colorBorder}`,
              borderRadius: 8,
              textAlign: 'center',
              cursor: 'pointer',
            }}
            onClick={() => {
              // Trigger file input
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.zip,.rar,.7z';
              input.onchange = () => {
                const file = input.files?.[0];
                if (file) {
                  const zipPath = window.api.latex.getFilePath(file);
                  if (zipPath) onImportZip(zipPath);
                }
              };
              input.click();
            }}
          >
            <Upload size={24} style={{ color: theme.colorTextSecondary, marginBottom: 8 }} />
            <div style={{ fontSize: 12, color: theme.colorTextSecondary, lineHeight: 1.6 }}>
              拖拽 LaTeX 模板压缩包到此处
              <br />
              或点击选择文件
            </div>
          </div>
        ) : (
          files.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              activeFile={activeFile}
              onFileSelect={onFileSelect}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>

      {/* New file modal */}
      <Modal
        title={newFileIsDir ? '新建文件夹' : '新建文件'}
        open={newFileModalOpen}
        onCancel={() => setNewFileModalOpen(false)}
        onOk={handleCreate}
        okText="创建"
        cancelText="取消"
      >
        <Input
          value={newFileName}
          onChange={(e) => setNewFileName(e.target.value)}
          placeholder={newFileIsDir ? '文件夹名称' : '文件名称（如 main.tex）'}
          autoFocus
          onPressEnter={handleCreate}
        />
      </Modal>

      {/* Rename modal */}
      <Modal
        title="重命名"
        open={renameModalOpen}
        onCancel={() => {
          setRenameModalOpen(false);
          setRenameTarget(null);
        }}
        onOk={handleRename}
        okText="确认"
        cancelText="取消"
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          autoFocus
          onPressEnter={handleRename}
        />
      </Modal>

      {/* Delete confirmation */}
      <Modal
        title="确认删除"
        open={deleteTarget !== null}
        onCancel={() => setDeleteTarget(null)}
        onOk={handleDelete}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <span>
          确定要删除 {deleteTarget?.type === 'directory' ? '文件夹' : '文件'}「{deleteTarget?.name}
          」吗？此操作不可撤销。
        </span>
      </Modal>
    </div>
  );
}

export const FileTreePanel = memo(FileTreePanelComp);
