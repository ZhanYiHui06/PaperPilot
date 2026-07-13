import { memo } from 'react';
import { Segmented } from 'antd';
import type { EmailFilterType } from './store';
import { EMAIL_TYPE_LABELS } from './store';

interface EmailFilterProps {
  value: EmailFilterType;
  onChange: (value: EmailFilterType) => void;
}

const OPTIONS: Array<{ label: string; value: EmailFilterType }> = [
  { label: '全部', value: 'all' },
  { label: EMAIL_TYPE_LABELS.review, value: 'review' },
  { label: EMAIL_TYPE_LABELS.decision, value: 'decision' },
];

function EmailFilterComp({ value, onChange }: EmailFilterProps): React.ReactElement {
  return (
    <Segmented<EmailFilterType>
      value={value}
      onChange={(val) => onChange(val)}
      options={OPTIONS}
    />
  );
}

export const EmailFilter = memo(EmailFilterComp);
