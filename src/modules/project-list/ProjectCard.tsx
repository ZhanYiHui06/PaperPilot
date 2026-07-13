import { memo } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ActionIcon, DropdownMenu, Tag, toast } from '@lobehub/ui';
import type { DropdownItem, MenuInfo } from '@lobehub/ui';
import { Modal } from 'antd';
import {
  Archive,
  EllipsisVertical,
  Pencil,
  Trash,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useTheme } from 'antd-style';
import { listItemVariants, TRANSITIONS } from '@renderer/lib/motion';
import { phaseConfig } from '@renderer/lib/phaseConfig';
import { useProjectStore } from '@renderer/stores/projectStore';
import type { Project } from '@shared/types';

interface ProjectCardProps {
  project: Project;
  index: number;
  onEdit?: (project: Project) => void;
}

const KEYWORD_TAG_LIMIT = 3;

// ─── Phase status pill — solid bg, white bold text ───
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

// ─── Target compound pill — [Target | venue] with vertical divider ───
function TargetPill({ venue }: { venue: string }): React.ReactElement {
  const theme = useTheme();
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'stretch',
        height: 22,
        borderRadius: 11,
        overflow: 'hidden',
        border: `1px solid ${theme.colorBorderSecondary}`,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0 8px',
          background: theme.colorFillSecondary,
          color: theme.colorTextSecondary,
          fontSize: 12,
          fontWeight: 500,
          lineHeight: 1,
        }}
      >
        Target
      </span>
      <span style={{ width: 1, background: theme.colorBorderSecondary, flexShrink: 0 }} />
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0 8px',
          background: theme.colorBgContainer,
          color: theme.colorText,
          fontSize: 12,
          fontWeight: 500,
          lineHeight: 1,
          maxWidth: 140,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {venue}
      </span>
    </span>
  );
}

function ProjectCardComp({ project, index, onEdit }: ProjectCardProps): React.ReactElement {
  const theme = useTheme();
  const navigate = useNavigate();
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const archiveProject = useProjectStore((s) => s.archiveProject);

  const phase = project.phase ?? 'ideation';
  const tags = project.tags ?? [];
  const visibleKeywordTags = tags.slice(0, KEYWORD_TAG_LIMIT);
  const hiddenKeywordCount = Math.max(0, tags.length - KEYWORD_TAG_LIMIT);

  const handleEdit = (info: MenuInfo): void => {
    info.domEvent.stopPropagation();
    onEdit?.(project);
  };

  const handleArchive = async (info: MenuInfo): Promise<void> => {
    info.domEvent.stopPropagation();
    try {
      await archiveProject(project.id);
      toast.success({ title: '项目已归档' });
    } catch (err) {
      const error = err as Error;
      toast.error({ title: '归档失败', description: error.message });
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
    { key: 'edit', label: '编辑', icon: Pencil, onClick: handleEdit },
    { key: 'archive', label: '归档', icon: Archive, onClick: handleArchive },
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
        cursor: 'pointer',
        borderWidth: 1,
        borderStyle: 'solid',
        // CSS vars drive :hover border — avoids Framer Motion whileHover stuck state on mount
        ['--pp-card-border' as string]: theme.colorBorderSecondary,
        ['--pp-card-border-hover' as string]: theme.colorPrimary,
        background: theme.colorBgContainer,
        padding: '20px 24px',
        marginBottom: 12,
      }}
      onClick={() => navigate(`/project/${project.id}`)}
    >
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        {/* Top row: tag group (left) + three-dot menu (right) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Phase status pill — solid color, white bold text */}
            <PhasePill phase={phase} />

            {/* Target compound pill — [Target | venue] with vertical divider */}
            {project.target_venue && <TargetPill venue={project.target_venue} />}

            {/* Keyword tags — up to 3, with +N overflow */}
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

          {/* Three-dot menu */}
          <DropdownMenu items={menuItems} trigger="click" placement="bottomRight">
            <ActionIcon
              icon={EllipsisVertical}
              size="small"
              onClick={(e) => e.stopPropagation()}
            />
          </DropdownMenu>
        </div>

        {/* Title — line-clamp-2 */}
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

        {/* Description — line-clamp-2 */}
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

        {/* Updated time — right-aligned */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <Tag variant="filled" color="gray" size="small">
            上次更新: {formatDistanceToNow(new Date(project.updated_at.replace(' ', 'T')), { locale: zhCN, addSuffix: true })}
          </Tag>
        </div>
      </div>
    </motion.div>
  );
}

export const ProjectCard = memo(ProjectCardComp);
