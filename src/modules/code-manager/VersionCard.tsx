import { memo } from 'react';
import { motion } from 'motion/react';
import { Tag } from '@lobehub/ui';
import { GitCommit } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useTheme } from 'antd-style';
import { cardHoverPropsFor, listItemVariants } from '@renderer/lib/motion';
import type { CodeVersion } from '@shared/types';

interface VersionCardProps {
  version: CodeVersion;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
}

const TAG_LIMIT = 3;

function VersionCardComp({
  version,
  index,
  selected,
  onSelect,
}: VersionCardProps): React.ReactElement {
  const theme = useTheme();
  const isDark = theme.appearance === 'dark';

  const tags = version.tags ?? [];
  const visibleTags = tags.slice(0, TAG_LIMIT);
  const hiddenCount = Math.max(0, tags.length - TAG_LIMIT);

  return (
    <motion.div
      layout
      initial="hidden"
      animate="visible"
      exit="exit"
      custom={index}
      variants={listItemVariants}
      {...cardHoverPropsFor(isDark)}
      onClick={() => onSelect(version.id)}
      style={{
        willChange: 'transform, box-shadow',
        borderRadius: 12,
        cursor: 'pointer',
        border: `1px solid ${selected ? theme.colorPrimary : theme.colorBorderSecondary}`,
        background: selected ? theme.colorFillTertiary : theme.colorBgContainer,
        padding: '14px 16px',
        marginBottom: 10,
        position: 'relative',
      }}
    >
      {/* Header row: label + Git indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <h4
          style={{
            fontSize: 14,
            fontWeight: 600,
            margin: 0,
            color: theme.colorText,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
          title={version.version_label}
        >
          {version.version_label}
        </h4>
        {version.git_commit_hash && (
          <Tag
            variant="filled"
            color="gray"
            shape="round"
            size="small"
            icon={<GitCommit size={12} />}
          >
            {version.git_commit_hash.slice(0, 7)}
          </Tag>
        )}
      </div>

      {/* Timestamp */}
      <div
        style={{
          fontSize: 12,
          color: theme.colorTextTertiary,
          marginTop: 4,
        }}
      >
        {formatDistanceToNow(new Date(version.timestamp), { locale: zhCN, addSuffix: true })}
      </div>

      {/* AI summary — line-clamp-3 */}
      {version.ai_summary ? (
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.55,
            color: theme.colorTextSecondary,
            margin: '8px 0 0 0',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {version.ai_summary}
        </p>
      ) : (
        <p
          style={{
            fontSize: 13,
            color: theme.colorTextTertiary,
            fontStyle: 'italic',
            margin: '8px 0 0 0',
          }}
        >
          暂无 AI 摘要
        </p>
      )}

      {/* Tags row */}
      {visibleTags.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            marginTop: 10,
          }}
        >
          {visibleTags.map((tag) => (
            <Tag key={tag} variant="filled" color="gray" shape="round" size="small">
              {tag}
            </Tag>
          ))}
          {hiddenCount > 0 && (
            <Tag variant="borderless" color="gray" shape="round" size="small">
              +{hiddenCount}
            </Tag>
          )}
        </div>
      )}
    </motion.div>
  );
}

export const VersionCard = memo(VersionCardComp);
