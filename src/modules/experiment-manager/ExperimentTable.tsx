import { memo, useMemo } from 'react';
import { Table } from 'antd';
import type { TableColumnsType } from 'antd';
import { Tag } from '@lobehub/ui';
import { format } from 'date-fns';
import { useTheme } from 'antd-style';
import type { Experiment } from '@shared/types';
import { EXPERIMENT_TYPE_META } from './ExperimentCard';
import { parseResultsTable } from './resultsUtils';

interface ExperimentTableProps {
  experiments: Experiment[];
  onRowClick: (id: string) => void;
}

function formatNullable(value: string | null, placeholder = '—'): string {
  return value && value.trim() ? value : placeholder;
}

function ExperimentTableComp({
  experiments,
  onRowClick,
}: ExperimentTableProps): React.ReactElement {
  const theme = useTheme();

  const columns = useMemo<TableColumnsType<Experiment>>(
    () => [
      {
        key: 'name',
        dataIndex: 'name',
        title: '名称',
        sorter: (a, b) => a.name.localeCompare(b.name),
        ellipsis: true,
        render: (_value: string, record: Experiment) => (
          <span style={{ fontWeight: 600, color: theme.colorText }}>{record.name}</span>
        ),
      },
      {
        key: 'experiment_type',
        dataIndex: 'experiment_type',
        title: '类型',
        width: 110,
        sorter: (a, b) => a.experiment_type.localeCompare(b.experiment_type),
        render: (value: Experiment['experiment_type']) => {
          const meta = EXPERIMENT_TYPE_META[value];
          return (
            <Tag variant="solid" color={meta.color} shape="round">
              {meta.label}
            </Tag>
          );
        },
      },
      {
        key: 'dataset',
        dataIndex: 'dataset',
        title: '数据集',
        sorter: (a, b) => (a.dataset ?? '').localeCompare(b.dataset ?? ''),
        ellipsis: true,
        render: (value: string | null) => (
          <span style={{ color: value ? theme.colorText : theme.colorTextTertiary }}>
            {formatNullable(value)}
          </span>
        ),
      },
      {
        key: 'methods',
        title: '方法数',
        width: 90,
        sorter: (a, b) => {
          const ta = parseResultsTable(a.metrics);
          const tb = parseResultsTable(b.metrics);
          return (ta?.methods.length ?? 0) - (tb?.methods.length ?? 0);
        },
        render: (_value: unknown, record: Experiment) => {
          const table = parseResultsTable(record.metrics);
          const count = table?.methods.length ?? 0;
          if (count > 0) return <span style={{ color: theme.colorText }}>{count} 个方法</span>;
          // Legacy fallback: show model field
          return (
            <span style={{ color: record.model ? theme.colorText : theme.colorTextTertiary }}>
              {formatNullable(record.model)}
            </span>
          );
        },
      },
      {
        key: 'created_at',
        dataIndex: 'created_at',
        title: '创建时间',
        width: 160,
        defaultSortOrder: 'descend',
        sorter: (a, b) => a.created_at.localeCompare(b.created_at),
        render: (value: string) => (
          <span style={{ color: theme.colorTextSecondary, fontSize: 13 }}>
            {format(new Date(value), 'yyyy-MM-dd HH:mm')}
          </span>
        ),
      },
    ],
    [theme],
  );

  return (
    <Table<Experiment>
      rowKey="id"
      columns={columns}
      dataSource={experiments}
      pagination={{ pageSize: 10, showSizeChanger: false, size: 'small' }}
      size="small"
      bordered
      onRow={(record) => ({
        onClick: () => onRowClick(record.id),
        style: { cursor: 'pointer' },
      })}
    />
  );
}

export const ExperimentTable = memo(ExperimentTableComp);
