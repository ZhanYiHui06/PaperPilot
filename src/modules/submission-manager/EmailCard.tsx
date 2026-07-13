import { memo } from 'react';
import { motion } from 'motion/react';
import { Tag } from '@lobehub/ui';
import { Star } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useTheme } from 'antd-style';
import { listItemVariants, TRANSITIONS } from '@renderer/lib/motion';
import type { Email } from '@shared/types';
import { EMAIL_TYPE_COLORS, EMAIL_TYPE_LABELS } from './store';

interface EmailCardProps {
  email: Email;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
}

function EmailCardComp({ email, index, selected, onSelect }: EmailCardProps): React.ReactElement {
  const theme = useTheme();
  const isUnread = email.is_read !== 1;
  const isImportant = email.is_important === 1;

  return (
    <motion.div
      layout
      initial="hidden"
      animate="visible"
      exit="exit"
      custom={index}
      variants={listItemVariants}
      whileHover={{
        boxShadow: theme.boxShadowTertiary,
        transition: TRANSITIONS.cardHover,
      }}
      onClick={() => onSelect(email.id)}
      style={{
        willChange: 'transform, box-shadow',
        cursor: 'pointer',
        borderRadius: 12,
        padding: '12px 14px',
        marginBottom: 8,
        border: `1px solid ${selected ? theme.colorPrimaryBorder : theme.colorBorderSecondary}`,
        background: selected
          ? theme.colorPrimaryBg
          : isUnread
            ? theme.colorFillQuaternary
            : theme.colorBgContainer,
      }}
    >
      {/* Top row: subject (bold, line-clamp-1) + importance flag */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <span
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight: isUnread ? 600 : 500,
            color: theme.colorText,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {email.subject || '(无主题)'}
        </span>
        {isImportant && (
          <Star size={14} fill={theme.colorWarning} color={theme.colorWarning} style={{ flexShrink: 0, marginTop: 2 }} />
        )}
      </div>

      {/* Bottom row: sender (gray, small) + type badge + received_at (right) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 6,
          flexWrap: 'wrap',
        }}
      >
        {email.email_type && email.email_type !== 'other' && (
          <Tag variant="solid" color={EMAIL_TYPE_COLORS[email.email_type === 'revision' ? 'decision' : email.email_type]} size="small" shape="round" style={{ color: '#fff', fontWeight: 600 }}>
            {EMAIL_TYPE_LABELS[email.email_type === 'revision' ? 'decision' : email.email_type]}
          </Tag>
        )}
        {email.email_type === 'other' && (
          <Tag variant="outline" color="default" size="small" shape="round">
            {EMAIL_TYPE_LABELS.other}
          </Tag>
        )}
        <span
          style={{
            flex: 1,
            fontSize: 12,
            color: theme.colorTextSecondary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {email.sender}
        </span>
        <span style={{ fontSize: 12, color: theme.colorTextTertiary, flexShrink: 0 }}>
          {formatDistanceToNow(new Date(email.received_at), { locale: zhCN, addSuffix: true })}
        </span>
      </div>
    </motion.div>
  );
}

export const EmailCard = memo(EmailCardComp);
