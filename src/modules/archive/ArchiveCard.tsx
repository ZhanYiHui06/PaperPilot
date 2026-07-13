import { memo } from 'react';
import { motion } from 'motion/react';
import { ActionIcon, DropdownMenu, Tag, toast } from '@lobehub/ui';
import type { DropdownItem, MenuInfo } from '@lobehub/ui';
import { Modal } from 'antd';
import { ArchiveRestore, EllipsisVertical, Trash } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useTheme } from 'antd-style';
import { listItemVariants } from '@renderer/lib/motion';
import { phaseConfig } from '@renderer/lib/phaseConfig';
import { useProjectStore } from '@renderer/stores/projectStore';
import type { Project } from '@shared/types';

interface ArchiveCardProps {
  project: Project;
  index: number;
}

const KEYWORD_TAG_LIMIT = 3;

function PhasePill({ phase }: { phase: NonNullable<Project['phase']> }): React.ReactElement {
  const meta = phaseConfig[phase] ?? phaseConfig.ideation;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        padding: '0 10px',
        borderRadius: 11,
        background: meta.bg,
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {meta.label}
    </span>
  );
}

function ArchiveCardComp({ project, index }: ArchiveCardProps): React.ReactElement {
  const theme = useTheme();
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const restoreProject = useProjectStore((s) => s.restoreProject);

  const phase = project.phase ?? 'ideation';
  const tags = project.tags ?? [];
  const visibleKeywordTags = tags.slice(0, KEYWORD_TAG_LIMIT);
  const hiddenKeywordCount = Math.max(0, tags.length - KEYWORD_TAG_LIMIT);

  const handleRestore = async (info: MenuInfo): Promise<void> => {
    info.domEvent.stopPropagation();
    try {
      await restoreProject(project.id);
      toast.success({ title: '项目已恢复', description: '已移回首页列表' });
    } catch (err) {
      const error = err as Error;
      toast.error({ title: '恢复失败', description: error.message });
    }
  };

  const handleDelete = (info: MenuInfo): void => {
    info.domEvent.stopPropagation();
    Modal.confirm({
      title: '删除项目',
      content: `确定要删除「${project.title}」吗？此操作不可撤销。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          await deleteProject(project.id);
          toast.success({ title: '项目已删除' });
        } catch (err) {
          const error = err as Error;
          toast.error({ title: '删除失败', description: error.message });
        }
      },
    });
  };

  const menuItems: DropdownItem[] = [
    { key: 'restore', label: '恢复项目', icon: ArchiveRestore, onClick: handleRestore },
    { type: 'divider', key: 'divider' },
    { key: 'delete', label: '删除', icon: Trash, danger: true, onClick: handleDelete },
  ];

  return (
    <motion.div
      layout
      initial="hidden"
      animate="visible"
      exit="exit"
      custom={index}
      variants={listItemVariants}
      className="pp-hover-border-card"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: 'solid',
        // CSS vars drive :hover border — avoids Framer Motion whileHover stuck state on mount
        ['--pp-card-border' as string]: theme.colorBorderSecondary,
        ['--pp-card-border-hover' as string]: theme.colorPrimary,
        background: theme.colorBgContainer,
        padding: '20px 24px',
        marginBottom: 12,
      }}
    >
      <div style={{ position: 'relative', zIndex: 2 }}>
        {/* Top row: tags (left) + three-dot menu (right) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <PhasePill phase={phase} />
            {project.target_venue && (
              <Tag variant="filled" shape="round" color="gray" size="small">
                {project.target_venue}
              </Tag>
            )}
            {visibleKeywordTags.map((tag) => (
              <Tag key={tag} variant="filled" shape="round" color="gray" size="small">
                {tag}
              </Tag>
            ))}
            {hiddenKeywordCount > 0 && (
              <Tag variant="borderless" shape="round" color="gray" size="small">
                +{hiddenKeywordCount}
              </Tag>
            )}
          </div>

          <DropdownMenu items={menuItems} trigger="click" placement="bottomRight">
            <ActionIcon icon={EllipsisVertical} size="small" onClick={(e) => e.stopPropagation()} />
          </DropdownMenu>
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: 18,
            fontWeight: 700,
            margin: '12px 0 8px 0',
            lineHeight: 1.4,
            color: theme.colorText,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {project.title}
        </h3>

        {/* Description */}
        {project.description && (
          <p
            style={{
              fontSize: 13,
              color: theme.colorTextSecondary,
              lineHeight: 1.6,
              margin: 0,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {project.description}
          </p>
        )}

        {/* Footer: updated time + restored hint */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 12,
          }}
        >
          <Tag variant="filled" color="gray" size="small">
            已归档
          </Tag>
          <Tag variant="filled" color="gray" size="small">
            上次更新: {formatDistanceToNow(new Date(project.updated_at.replace(' ', 'T')), { locale: zhCN, addSuffix: true })}
          </Tag>
        </div>
      </div>
    </motion.div>
  );
}

export const ArchiveCard = memo(ArchiveCardComp);
