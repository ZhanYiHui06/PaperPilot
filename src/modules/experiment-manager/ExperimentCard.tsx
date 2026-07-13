import { memo } from 'react';
import { motion } from 'motion/react';
import { Tag } from '@lobehub/ui';
import { Database } from 'lucide-react';
import { useTheme } from 'antd-style';
import { cardHoverPropsFor, listItemVariants } from '@renderer/lib/motion';
import type { Experiment, ExperimentType } from '@shared/types';
import { parseResultsTable } from './resultsUtils';

interface ExperimentTypeMeta {
  label: string;
  color: string;
}

export const EXPERIMENT_TYPE_META: Record<ExperimentType, ExperimentTypeMeta> = {
  comparison: { label: '对比', color: 'blue' },
  ablation: { label: '消融', color: 'purple' },
  sensitivity: { label: '敏感性', color: 'orange' },
  other: { label: '其他', color: 'gray' },
};

const METHOD_PREVIEW_LIMIT = 3;

interface ExperimentCardProps {
  experiment: Experiment;
  index: number;
  onClick: (id: string) => void;
}

function ExperimentCardComp({
  experiment,
  index,
  onClick,
}: ExperimentCardProps): React.ReactElement {
  const theme = useTheme();
  const isDark = theme.appearance === 'dark';
  const typeMeta = EXPERIMENT_TYPE_META[experiment.experiment_type];

  // Parse the results table from the metrics JSON field
  const resultsTable = parseResultsTable(experiment.metrics);
  const previewMethods = resultsTable
    ? resultsTable.methods.slice(0, METHOD_PREVIEW_LIMIT)
    : [];
  const hiddenMethodCount = resultsTable
    ? Math.max(0, resultsTable.methods.length - METHOD_PREVIEW_LIMIT)
    : 0;

  return (
    <motion.div
      layout
      initial="hidden"
      animate="visible"
      exit="exit"
      custom={index}
      variants={listItemVariants}
      {...cardHoverPropsFor(isDark)}
      onClick={() => onClick(experiment.id)}
      style={{
        willChange: 'transform, box-shadow',
        borderRadius: 12,
        cursor: 'pointer',
        border: `1px solid ${theme.colorBorderSecondary}`,
        background: theme.colorBgContainer,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Top row: type badge + status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Tag variant="solid" color={typeMeta.color} shape="round">
          {typeMeta.label}
        </Tag>
        <span style={{ fontSize: 12, color: theme.colorTextTertiary }}>
          {experiment.status}
        </span>
      </div>

      {/* Name */}
      <h3
        style={{
          fontSize: 15,
          fontWeight: 700,
          margin: 0,
          lineHeight: 1.4,
          color: theme.colorText,
          display: '-webkit-box',
          WebkitLineClamp: 1,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {experiment.name}
      </h3>

      {/* Dataset */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: theme.colorTextSecondary,
        }}
      >
        <Database size={13} style={{ flexShrink: 0, color: theme.colorTextTertiary }} />
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {experiment.dataset || '未指定数据集'}
        </span>
      </div>

      {/* Results table preview — compact method × metric highlights */}
      {resultsTable && resultsTable.methods.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            paddingTop: 4,
            borderTop: `1px solid ${theme.colorBorderSecondary}`,
          }}
        >
          {previewMethods.map((method, mi) => {
            const bestValue = method.values.find((v) => v.trim());
            return (
              <Tag key={mi} variant="filled" color="green" shape="round" size="small">
                {method.name || `方法${mi + 1}`}
                {bestValue ? `: ${bestValue}` : ''}
              </Tag>
            );
          })}
          {hiddenMethodCount > 0 && (
            <Tag variant="borderless" color="gray" shape="round" size="small">
              +{hiddenMethodCount}
            </Tag>
          )}
        </div>
      )}

      {/* Fallback: legacy flat key-value metrics (for old experiments) */}
      {!resultsTable && experiment.metrics && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            paddingTop: 4,
            borderTop: `1px solid ${theme.colorBorderSecondary}`,
          }}
        >
          {Object.entries(experiment.metrics)
            .slice(0, 3)
            .map(([key, value]) => (
              <Tag key={key} variant="filled" color="green" shape="round" size="small">
                {key}: {String(value)}
              </Tag>
            ))}
        </div>
      )}
    </motion.div>
  );
}

export const ExperimentCard = memo(ExperimentCardComp);
