import { memo } from 'react';
import { Button, Tag, toast } from '@lobehub/ui';
import { Card, Modal } from 'antd';
import { Sparkles, GitCommit, Clock, FileDiff, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useTheme } from 'antd-style';
import { useCodeManagerStore } from './store';
import type { CodeVersion } from '@shared/types';

interface VersionDetailProps {
  version: CodeVersion;
}

function VersionDetailComp({ version }: VersionDetailProps): React.ReactElement {
  const theme = useTheme();
  const regenerateSummary = useCodeManagerStore((s) => s.regenerateSummary);
  const regeneratingId = useCodeManagerStore((s) => s.regeneratingId);
  const deleteVersion = useCodeManagerStore((s) => s.deleteVersion);
  const deletingId = useCodeManagerStore((s) => s.deletingId);

  const isRegenerating = regeneratingId === version.id;
  const isDeleting = deletingId === version.id;
  const canRegenerate = !!version.diff_text;

  const handleRegenerate = (): void => {
    void regenerateSummary(version);
  };

  const handleDelete = (): void => {
    Modal.confirm({
      title: '删除版本',
      content: `确定要删除「${version.version_label}」吗？此操作不可撤销。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          await deleteVersion(version.id);
          toast.success({ title: '版本已删除' });
        } catch (e: unknown) {
          toast.error({
            title: '删除失败',
            description: e instanceof Error ? e.message : String(e),
          });
        }
      },
    });
  };

  const tags = version.tags ?? [];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        height: '100%',
        overflowY: 'auto',
        padding: 4,
      }}
    >
      {/* Header — label + meta */}
      <Card
        style={{
          borderRadius: 12,
          border: `1px solid ${theme.colorBorderSecondary}`,
          background: theme.colorBgContainer,
        }}
        styles={{ body: { padding: 20 } }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              margin: 0,
              color: theme.colorText,
              lineHeight: 1.4,
              flex: 1,
            }}
          >
            {version.version_label}
          </h2>
          <Button
            size="small"
            type="text"
            danger
            icon={<Trash2 size={14} />}
            loading={isDeleting}
            onClick={handleDelete}
          >
            删除
          </Button>
        </div>

        {/* Metadata row */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            marginTop: 12,
            fontSize: 13,
            color: theme.colorTextSecondary,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={14} />
            {format(new Date(version.timestamp), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
          </span>
          {version.git_commit_hash && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              }}
            >
              <GitCommit size={14} />
              {version.git_commit_hash}
            </span>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 12 }}>
            {tags.map((tag) => (
              <Tag key={tag} variant="filled" color="gray" shape="round" size="small">
                {tag}
              </Tag>
            ))}
          </div>
        )}
      </Card>

      {/* AI Summary block */}
      <Card
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={16} style={{ color: theme.colorPrimary }} />
            AI 摘要
          </span>
        }
        extra={
          <Button
            size="small"
            type="text"
            icon={<Sparkles size={14} />}
            loading={isRegenerating}
            disabled={!canRegenerate || isRegenerating}
            onClick={handleRegenerate}
          >
            重新生成
          </Button>
        }
        style={{
          borderRadius: 12,
          border: `1px solid ${theme.colorBorderSecondary}`,
          background: theme.colorBgContainer,
        }}
        styles={{ body: { padding: 20 } }}
      >
        {version.ai_summary ? (
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              margin: 0,
              color: theme.colorText,
              whiteSpace: 'pre-wrap',
            }}
          >
            {version.ai_summary}
          </p>
        ) : (
          <p
            style={{
              fontSize: 13,
              margin: 0,
              color: theme.colorTextTertiary,
              fontStyle: 'italic',
            }}
          >
            {canRegenerate
              ? '暂无 AI 摘要，点击右上角"重新生成"创建。'
              : '暂无 AI 摘要，且未提供 diff 内容，无法自动生成。'}
          </p>
        )}
      </Card>

      {/* Diff block */}
      <Card
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <FileDiff size={16} />
            Diff
          </span>
        }
        style={{
          borderRadius: 12,
          border: `1px solid ${theme.colorBorderSecondary}`,
          background: theme.colorBgContainer,
        }}
        styles={{ body: { padding: 0 } }}
      >
        {version.diff_text ? (
          <pre
            style={{
              margin: 0,
              padding: 16,
              fontSize: 12,
              lineHeight: 1.6,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              color: theme.colorText,
              background: theme.colorFillQuaternary,
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              borderBottomLeftRadius: 12,
              borderBottomRightRadius: 12,
            }}
          >
            {version.diff_text}
          </pre>
        ) : (
          <div
            style={{
              padding: 24,
              color: theme.colorTextTertiary,
              fontSize: 13,
              fontStyle: 'italic',
              textAlign: 'center',
            }}
          >
            No diff available
          </div>
        )}
      </Card>
    </div>
  );
}

export const VersionDetail = memo(VersionDetailComp);
