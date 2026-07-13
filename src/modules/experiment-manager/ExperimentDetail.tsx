import { memo, useState, useRef, useEffect } from 'react';
import { Modal, Tag, Button, toast, Markdown } from '@lobehub/ui';
import { Sparkles, Database, Clock, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { useTheme } from 'antd-style';
import type { Experiment } from '@shared/types';
import { EXPERIMENT_TYPE_META } from './ExperimentCard';
import { parseResultsTable } from './resultsUtils';

interface ExperimentDetailProps {
  experiment: Experiment | null;
  open: boolean;
  onClose: () => void;
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  theme: ReturnType<typeof useTheme>;
}

function DetailRow({ icon, label, value, theme }: DetailRowProps): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ display: 'inline-flex', marginTop: 2, color: theme.colorTextTertiary }}>
        {icon}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 12, color: theme.colorTextTertiary }}>{label}</span>
        <span style={{ fontSize: 14, color: theme.colorText, wordBreak: 'break-word' }}>
          {value}
        </span>
      </div>
    </div>
  );
}

/** Renders the methods × metrics results table. */
function ResultsTable({ experiment, theme }: { experiment: Experiment; theme: ReturnType<typeof useTheme> }): React.ReactElement | null {
  const resultsTable = parseResultsTable(experiment.metrics);

  if (resultsTable && resultsTable.methods.length > 0) {
    return (
      <div
        style={{
          overflowX: 'auto',
          borderRadius: 8,
          border: `1px solid ${theme.colorBorderSecondary}`,
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
          }}
        >
          <thead>
            <tr style={{ background: theme.colorFillQuaternary }}>
              <th
                style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: theme.colorText,
                  borderBottom: `1px solid ${theme.colorBorderSecondary}`,
                  whiteSpace: 'nowrap',
                }}
              >
                方法
              </th>
              {resultsTable.metric_names.map((name, i) => (
                <th
                  key={i}
                  style={{
                    padding: '8px 12px',
                    textAlign: 'center',
                    fontWeight: 600,
                    color: theme.colorText,
                    borderBottom: `1px solid ${theme.colorBorderSecondary}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {name || `指标${i + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resultsTable.methods.map((method, ri) => (
              <tr key={ri}>
                <td
                  style={{
                    padding: '8px 12px',
                    fontWeight: 500,
                    color: theme.colorText,
                    borderBottom: ri < resultsTable.methods.length - 1
                      ? `1px solid ${theme.colorBorderSecondary}`
                      : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {method.name || `方法${ri + 1}`}
                </td>
                {resultsTable.metric_names.map((_, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'center',
                      color: theme.colorTextSecondary,
                      borderBottom: ri < resultsTable.methods.length - 1
                        ? `1px solid ${theme.colorBorderSecondary}`
                        : 'none',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                    }}
                  >
                    {method.values[ci] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Fallback: legacy flat key-value metrics
  if (experiment.metrics) {
    const entries = Object.entries(experiment.metrics);
    if (entries.length > 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.map(([key, value]) => (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 8,
                background: theme.colorFillQuaternary,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, color: theme.colorText }}>{key}</span>
              <span style={{ fontSize: 13, color: theme.colorTextSecondary, marginLeft: 'auto' }}>
                {String(value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
  }

  return <span style={{ fontSize: 13, color: theme.colorTextTertiary }}>未设置评估指标</span>;
}

function ExperimentDetailComp({
  experiment,
  open,
  onClose,
}: ExperimentDetailProps): React.ReactElement {
  const theme = useTheme();
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  // Preserve the last experiment so the Modal remains rendered during the exit animation
  const lastExperimentRef = useRef<Experiment | null>(null);
  if (experiment) {
    lastExperimentRef.current = experiment;
  }
  // Reset summary when experiment changes (new detail opened)
  useEffect(() => {
    if (experiment) {
      setSummary(null);
    }
  }, [experiment]);

  const displayExperiment = experiment ?? lastExperimentRef.current;
  if (!displayExperiment && !open) {
    return null;
  }
  if (!displayExperiment) {
    return null;
  }

  const typeMeta = EXPERIMENT_TYPE_META[displayExperiment.experiment_type];

  const handleSummarize = async (): Promise<void> => {
    if (!displayExperiment) return;
    setSummarizing(true);
    try {
      const content = JSON.stringify({
        name: displayExperiment.name,
        type: displayExperiment.experiment_type,
        dataset: displayExperiment.dataset,
        metrics: displayExperiment.metrics,
        notes: displayExperiment.notes,
      });
      const result = await window.api.llm.summarize('experiment', content);
      setSummary(result);
    } catch (e) {
      const error = e as Error;
      toast.error({ title: '生成摘要失败', description: error.message });
    } finally {
      setSummarizing(false);
    }
  };

  const handleClose = (): void => {
    setSummary(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{displayExperiment.name}</span>
          <Tag variant="solid" color={typeMeta.color} shape="round">
            {typeMeta.label}
          </Tag>
        </div>
      }
      width={680}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Basic info */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <DetailRow
            icon={<Database size={16} />}
            label="数据集"
            value={displayExperiment.dataset || '未指定'}
            theme={theme}
          />
          <DetailRow
            icon={<Clock size={16} />}
            label="创建时间"
            value={format(new Date(displayExperiment.created_at), 'yyyy-MM-dd HH:mm:ss')}
            theme={theme}
          />
        </section>

        {/* Results table — methods × metrics */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: theme.colorText }}>
            实验结果
          </h4>
          <ResultsTable experiment={displayExperiment} theme={theme} />
        </section>

        {/* Notes */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: theme.colorText }}>
            <FileText size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            备注
          </h4>
          {displayExperiment.notes ? (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: theme.colorTextSecondary,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {displayExperiment.notes}
            </p>
          ) : (
            <span style={{ fontSize: 13, color: theme.colorTextTertiary }}>暂无备注</span>
          )}
        </section>

        {/* LLM summary */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: theme.colorText }}>
              AI 摘要
            </h4>
            <Button
              size="small"
              icon={<Sparkles size={14} />}
              loading={summarizing}
              onClick={() => {
                void handleSummarize();
              }}
            >
              {summary ? '重新生成' : '生成摘要'}
            </Button>
          </div>
          {summarizing ? null : summary ? (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: theme.colorFillQuaternary,
              }}
            >
              <Markdown variant="chat" fontSize={13}>
                {summary}
              </Markdown>
            </div>
          ) : (
            <span style={{ fontSize: 13, color: theme.colorTextTertiary }}>
              点击「生成摘要」让 AI 整理本次实验的设置与结果（仅整理，不提供优化建议）
            </span>
          )}
        </section>
      </div>
    </Modal>
  );
}

export const ExperimentDetail = memo(ExperimentDetailComp);
