import { memo } from 'react';
import { Button, Empty, Tag } from '@lobehub/ui';
import { Mail, MailOpen, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useTheme } from 'antd-style';
import type { Email } from '@shared/types';
import {
  EMAIL_TYPE_COLORS,
  EMAIL_TYPE_LABELS,
  matchesPaperTitle,
  useSubmissionStore,
} from './store';

interface EmailDetailContentProps {
  email: Email | null;
}

function EmailDetailContent({ email }: EmailDetailContentProps): React.ReactElement {
  const theme = useTheme();
  const reclassifyingId = useSubmissionStore((s) => s.reclassifyingId);
  const togglingReadId = useSubmissionStore((s) => s.togglingReadId);
  const reclassifyEmail = useSubmissionStore((s) => s.reclassifyEmail);
  const toggleRead = useSubmissionStore((s) => s.toggleRead);

  if (!email) {
    return (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Empty
          title="未选择邮件"
          description="从左侧列表选择一封邮件以查看详情"
          type="page"
        />
      </div>
    );
  }

  const isRead = email.is_read === 1;
  const isReclassifying = reclassifyingId === email.id;
  const isTogglingRead = togglingReadId === email.id;
  const receivedDate = new Date(email.received_at);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: 24,
      }}
    >
      {/* Header: subject (large) + type badge */}
      <div style={{ marginBottom: 12 }}>
        <h2
          style={{
            margin: '0 0 8px 0',
            fontSize: 20,
            fontWeight: 700,
            lineHeight: 1.4,
            color: theme.colorText,
            wordBreak: 'break-word',
          }}
        >
          {email.subject || '(无主题)'}
        </h2>
        {email.email_type && email.email_type !== 'other' && (
          <Tag variant="solid" color={EMAIL_TYPE_COLORS[email.email_type === 'revision' ? 'decision' : email.email_type]} shape="round" style={{ color: '#fff', fontWeight: 600 }}>
            {EMAIL_TYPE_LABELS[email.email_type === 'revision' ? 'decision' : email.email_type]}
          </Tag>
        )}
        {email.email_type === 'other' && (
          <Tag variant="outline" color="default" shape="round">
            {EMAIL_TYPE_LABELS.other}
          </Tag>
        )}
      </div>

      {/* Meta: sender + received_at */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          fontSize: 13,
          color: theme.colorTextSecondary,
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: `1px solid ${theme.colorBorderSecondary}`,
        }}
      >
        <span style={{ fontWeight: 500, color: theme.colorText }}>{email.sender}</span>
        <span style={{ color: theme.colorTextTertiary }}>
          {format(receivedDate, 'yyyy-MM-dd HH:mm', { locale: zhCN })}
        </span>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Button
          icon={<Sparkles size={16} />}
          loading={isReclassifying}
          onClick={() => reclassifyEmail(email.id)}
        >
          重新分类
        </Button>
        <Button
          icon={isRead ? <Mail size={16} /> : <MailOpen size={16} />}
          loading={isTogglingRead}
          onClick={() => toggleRead(email)}
        >
          {isRead ? '标为未读' : '标为已读'}
        </Button>
      </div>

      {/* AI summary — highlighted box */}
      {email.ai_summary && (
        <div
          style={{
            padding: '12px 14px',
            marginBottom: 16,
            borderRadius: 8,
            background: theme.colorInfoBg,
            border: `1px solid ${theme.colorInfoBorder}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 6,
              fontSize: 12,
              fontWeight: 600,
              color: theme.colorInfoText,
            }}
          >
            <Sparkles size={14} />
            AI 摘要
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.6,
              color: theme.colorText,
              whiteSpace: 'pre-wrap',
            }}
          >
            {email.ai_summary}
          </p>
        </div>
      )}

      {/* Raw content */}
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: theme.colorTextSecondary,
            marginBottom: 8,
          }}
        >
          邮件正文
        </div>
        {email.raw_content ? (
          <pre
            style={{
              margin: 0,
              padding: 14,
              borderRadius: 8,
              background: theme.colorBgLayout,
              border: `1px solid ${theme.colorBorderSecondary}`,
              fontSize: 13,
              lineHeight: 1.7,
              color: theme.colorText,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'inherit',
            }}
          >
            {email.raw_content}
          </pre>
        ) : (
          <Empty description="无邮件正文" />
        )}
      </div>
    </div>
  );
}

interface EmailDetailProps {
  loading: boolean;
}

// Wrapper that resolves the selected email from the store and renders the detail.
// Only paper-title-matched emails are previewable, matching the left list.
function EmailDetailComp({ loading }: EmailDetailProps): React.ReactElement {
  const emails = useSubmissionStore((s) => s.emails);
  const selectedId = useSubmissionStore((s) => s.selectedId);
  const paperTitle = useSubmissionStore((s) => s.paperTitle);

  const selected = selectedId
    ? emails.find(
        (e) => e.id === selectedId && matchesPaperTitle(e, paperTitle),
      ) ?? null
    : null;

  if (loading && !selected) return null;

  return <EmailDetailContent email={selected} />;
}

export const EmailDetail = memo(EmailDetailComp);
