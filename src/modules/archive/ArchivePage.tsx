import { memo, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { motion } from 'motion/react';
import { Button, Empty } from '@lobehub/ui';
import { ArrowLeft, Archive } from 'lucide-react';
import { useTheme } from 'antd-style';
import { useNavigate } from 'react-router-dom';
import { headerVariants } from '@renderer/lib/motion';
import { useProjectStore } from '@renderer/stores/projectStore';
import { ArchiveCard } from './ArchiveCard';

function ArchivePageComp(): React.ReactElement {
  const theme = useTheme();
  const navigate = useNavigate();
  const archivedProjects = useProjectStore((s) => s.archivedProjects);
  const archivedLoading = useProjectStore((s) => s.archivedLoading);
  const error = useProjectStore((s) => s.error);
  const fetchArchivedProjects = useProjectStore((s) => s.fetchArchivedProjects);

  useEffect(() => {
    fetchArchivedProjects();
  }, [fetchArchivedProjects]);

  const handleRetry = (): void => {
    fetchArchivedProjects();
  };

  const renderContent = (): React.ReactNode => {
    if (archivedLoading) {
      return null;
    }

    if (error) {
      return (
        <Empty
          title="加载失败"
          description={error}
          type="page"
          action={<Button onClick={handleRetry}>重试</Button>}
        />
      );
    }

    if (archivedProjects.length === 0) {
      return (
        <Empty
          icon={Archive}
          title="暂无归档项目"
          description="归档后的项目会显示在这里，可随时恢复"
          type="page"
        />
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* initial 默认 true：进入归档页时播放卡片入场动效；删除/恢复时仍走 exit */}
        <AnimatePresence>
          {archivedProjects.map((project, index) => (
            <ArchiveCard key={project.id} project={project} index={index} />
          ))}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: theme.colorBgLayout,
        overflow: 'hidden',
      }}
    >
      {/* Header bar — float down */}
      <motion.div
        variants={headerVariants}
        initial="hidden"
        animate="visible"
        style={{
          flexShrink: 0,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 24px',
          borderBottom: `1px solid ${theme.colorBorderSecondary}`,
          background: theme.colorBgContainer,
        }}
      >
        <Button size="small" icon={<ArrowLeft size={16} />} onClick={() => navigate('/')}>
          返回首页
        </Button>
        <div style={{ width: 1, height: 20, background: theme.colorBorderSecondary, flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Archive size={18} style={{ color: theme.colorText }} />
          <span
            style={{
              fontFamily: 'Montserrat, OPPO Sans 4.0, OPPO Sans, sans-serif',
              fontSize: 15,
              fontWeight: 700,
              color: theme.colorText,
              letterSpacing: '-0.01em',
              lineHeight: 1,
              display: 'inline-block',
              transform: 'translateY(-1px)',
            }}
          >
            归档
          </span>
          {archivedProjects.length > 0 && (
            <span
              style={{
                fontSize: 12,
                color: theme.colorTextTertiary,
                fontWeight: 500,
                marginLeft: 4,
              }}
            >
              ({archivedProjects.length})
            </span>
          )}
        </div>
      </motion.div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px 32px',
        }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto' }}>{renderContent()}</div>
      </div>
    </div>
  );
}

export const ArchivePage = memo(ArchivePageComp);
