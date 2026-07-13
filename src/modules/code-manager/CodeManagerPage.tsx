import { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button, Empty, Tag, toast } from '@lobehub/ui';
import { Plus, GitBranch, Code, AlertCircle } from 'lucide-react';
import { useTheme } from 'antd-style';
import { useParams } from 'react-router-dom';
import { pageVariants } from '@renderer/lib/motion';
import { useCodeManagerStore } from './store';
import { VersionCard } from './VersionCard';
import { VersionDetail } from './VersionDetail';
import { AddVersionModal } from './AddVersionModal';

function CodeManagerPageComp(): React.ReactElement {
  const theme = useTheme();
  const { id } = useParams<{ id: string }>();
  const {
    versions,
    selectedId,
    loading,
    error,
    gitRepoPath,
    gitLoading,
    loadVersions,
    selectVersion,
    detectGitRepo,
  } = useCodeManagerStore();

  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    void loadVersions(id);
  }, [id, loadVersions]);

  useEffect(() => {
    // Detect Git repo once on mount — used by mode indicator and Git-mode submit
    void detectGitRepo();
  }, [detectGitRepo]);

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedId) ?? null,
    [versions, selectedId],
  );

  const handleRetry = (): void => {
    if (!id) return;
    void loadVersions(id);
  };

  const renderLeftPanel = (): React.ReactNode => {
    if (loading) {
      return null;
    }

    if (error) {
      return (
        <Empty
          icon={AlertCircle}
          title="加载失败"
          description={error}
          type="page"
          action={<Button onClick={handleRetry}>重试</Button>}
        />
      );
    }

    if (versions.length === 0) {
      return (
        <Empty
          icon={Code}
          title="暂无代码版本"
          description="点击右上角“记录版本”按钮开始追踪代码变更"
          type="page"
        />
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence initial={false}>
          {versions.map((version, index) => (
            <VersionCard
              key={version.id}
              version={version}
              index={index}
              selected={version.id === selectedId}
              onSelect={selectVersion}
            />
          ))}
        </AnimatePresence>
      </div>
    );
  };

  const renderRightPanel = (): React.ReactNode => {
    if (loading) {
      return null;
    }

    if (!selectedVersion) {
      return (
        <Empty
          icon={Code}
          title={versions.length === 0 ? '暂无版本可显示' : '请选择一个版本'}
          description={
            versions.length === 0
              ? '记录第一个代码版本以查看详情'
              : '从左侧列表选择一个版本以查看详情'
          }
          type="page"
        />
      );
    }

    return <VersionDetail version={selectedVersion} />;
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: theme.colorBgLayout,
        overflow: 'hidden',
      }}
    >
      {/* Top toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 12px',
          border: `1px solid ${theme.colorBorderSecondary}`,
          borderRadius: 8,
          marginBottom: 12,
          background: theme.colorBgContainer,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Code size={18} style={{ color: theme.colorText }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: theme.colorText }}>
            代码版本管理
          </span>
          {/* Git mode indicator */}
          {gitLoading ? (
            <Tag variant="filled" color="gray" shape="round" size="small">
              检测中...
            </Tag>
          ) : gitRepoPath ? (
            <Tag variant="filled" color="green" shape="round" size="small" icon={<GitBranch size={12} />}>
              Git 已连接
            </Tag>
          ) : (
            <Tag variant="outlined" color="gray" shape="round" size="small" icon={<GitBranch size={12} />}>
              Git 未配置
            </Tag>
          )}
        </div>
        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={() => {
            if (!id) {
              toast.error({ title: '未找到项目 ID' });
              return;
            }
            setModalOpen(true);
          }}
        >
          记录版本
        </Button>
      </div>

      {/* Split layout — left 40% / right 60% */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div
          style={{
            width: '40%',
            overflowY: 'auto',
            padding: 16,
            borderRight: `1px solid ${theme.colorBorderSecondary}`,
            background: theme.colorBgLayout,
          }}
        >
          {renderLeftPanel()}
        </div>
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            padding: 16,
            background: theme.colorBgLayout,
          }}
        >
          {renderRightPanel()}
        </div>
      </div>

      {id && (
        <AddVersionModal
          projectId={id}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      )}
    </motion.div>
  );
}

export const CodeManagerPage = memo(CodeManagerPageComp);
