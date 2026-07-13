import { memo, useCallback } from 'react';
import { Input, Button } from '@lobehub/ui';
import { Plus, Trash2, X } from 'lucide-react';
import { useTheme } from 'antd-style';

/**
 * Structured experiment results: a methods × metrics matrix.
 * Stored in the Experiment.metrics JSON field.
 */
export interface ExperimentResultTable {
  metric_names: string[];
  methods: Array<{
    name: string;
    values: string[];
  }>;
}

export interface ExperimentResultsEditorProps {
  /** Current value — injected by antd Form.Item. */
  value?: ExperimentResultTable | null;
  /** Change handler — injected by antd Form.Item. */
  onChange?: (value: ExperimentResultTable | null) => void;
}

function ensureTable(value: ExperimentResultTable | null | undefined): ExperimentResultTable {
  if (!value) return { metric_names: [], methods: [] };
  return {
    metric_names: Array.isArray(value.metric_names) ? value.metric_names : [],
    methods: Array.isArray(value.methods) ? value.methods : [],
  };
}

function ensureValues(values: string[] | undefined, len: number): string[] {
  const arr = Array.isArray(values) ? values : [];
  if (arr.length >= len) return arr.slice(0, len);
  return [...arr, ...Array(len - arr.length).fill('')];
}

function ExperimentResultsEditorComp({
  value,
  onChange,
}: ExperimentResultsEditorProps): React.ReactElement {
  const theme = useTheme();
  const table = ensureTable(value);
  const colCount = table.metric_names.length;

  const emit = useCallback(
    (next: ExperimentResultTable) => {
      const hasAny =
        next.metric_names.some((m) => m.trim()) ||
        next.methods.some((m) => m.name.trim() || m.values.some((v) => v.trim()));
      onChange?.(hasAny ? next : null);
    },
    [onChange],
  );

  // --- Column (metric) operations ---
  const handleAddMetric = () => {
    emit({
      metric_names: [...table.metric_names, ''],
      methods: table.methods.map((m) => ({ ...m, values: [...m.values, ''] })),
    });
  };

  const handleMetricNameChange = (colIndex: number, name: string) => {
    const next = {
      ...table,
      metric_names: table.metric_names.map((n, i) => (i === colIndex ? name : n)),
    };
    emit(next);
  };

  const handleDeleteMetric = (colIndex: number) => {
    emit({
      metric_names: table.metric_names.filter((_, i) => i !== colIndex),
      methods: table.methods.map((m) => ({
        ...m,
        values: m.values.filter((_, i) => i !== colIndex),
      })),
    });
  };

  // --- Row (method) operations ---
  const handleAddMethod = () => {
    emit({
      ...table,
      methods: [...table.methods, { name: '', values: Array(colCount).fill('') }],
    });
  };

  const handleMethodNameChange = (rowIndex: number, name: string) => {
    const next = {
      ...table,
      methods: table.methods.map((m, i) => (i === rowIndex ? { ...m, name } : m)),
    };
    emit(next);
  };

  const handleValueChange = (rowIndex: number, colIndex: number, val: string) => {
    const next = {
      ...table,
      methods: table.methods.map((m, i) => {
        if (i !== rowIndex) return m;
        const values = ensureValues(m.values, colCount);
        return { ...m, values: values.map((v, ci) => (ci === colIndex ? val : v)) };
      }),
    };
    emit(next);
  };

  const handleDeleteMethod = (rowIndex: number) => {
    emit({
      ...table,
      methods: table.methods.filter((_, i) => i !== rowIndex),
    });
  };

  const inputStyle: React.CSSProperties = {
    fontSize: 13,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {colCount === 0 && table.methods.length === 0 && (
        <div style={{ fontSize: 13, color: theme.colorTextTertiary, padding: '6px 0' }}>
          暂无数据，先添加评估指标列，再添加方法行
        </div>
      )}

      {/* Header row: method name label + metric columns + add metric button */}
      {colCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 120, flexShrink: 0, fontSize: 12, fontWeight: 600, color: theme.colorTextSecondary }}>
            方法 / 指标
          </div>
          <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
            {table.metric_names.map((name, colIndex) => (
              <div key={colIndex} style={{ display: 'flex', alignItems: 'center', gap: 2, flex: '1 1 100px', minWidth: 80 }}>
                <Input
                  value={name}
                  placeholder="指标名"
                  onChange={(e) => handleMetricNameChange(colIndex, e.target.value)}
                  style={{ ...inputStyle, fontWeight: 500 }}
                />
                <Button
                  icon={<X size={12} />}
                  type="text"
                  size="small"
                  onClick={() => handleDeleteMetric(colIndex)}
                  style={{ flexShrink: 0, color: theme.colorTextTertiary }}
                />
              </div>
            ))}
          </div>
          <div style={{ width: 32, flexShrink: 0 }} />
        </div>
      )}

      {/* Method rows */}
      {table.methods.map((method, rowIndex) => (
        <div key={rowIndex} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 120, flexShrink: 0 }}>
            <Input
              value={method.name}
              placeholder="方法名"
              onChange={(e) => handleMethodNameChange(rowIndex, e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
            {table.metric_names.map((_, colIndex) => (
              <Input
                key={colIndex}
                value={ensureValues(method.values, colCount)[colIndex] ?? ''}
                placeholder="—"
                onChange={(e) => handleValueChange(rowIndex, colIndex, e.target.value)}
                style={{ ...inputStyle, flex: '1 1 100px', minWidth: 80 }}
              />
            ))}
          </div>
          <Button
            icon={<Trash2 size={14} />}
            type="text"
            danger
            size="small"
            onClick={() => handleDeleteMethod(rowIndex)}
            style={{ flexShrink: 0, width: 32 }}
          />
        </div>
      ))}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button type="dashed" icon={<Plus size={14} />} onClick={handleAddMetric} size="small">
          添加指标列
        </Button>
        {colCount > 0 && (
          <Button type="dashed" icon={<Plus size={14} />} onClick={handleAddMethod} size="small">
            添加方法行
          </Button>
        )}
      </div>
    </div>
  );
}

export const ExperimentResultsEditor = memo(ExperimentResultsEditorComp);
