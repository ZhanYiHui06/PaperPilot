import { memo, useMemo } from 'react';
import { Select } from '@lobehub/ui';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { LatexVersion } from '@shared/types';

interface VersionDropdownProps {
  versions: LatexVersion[];
  selectedId: string | null;
  loading?: boolean;
  onChange: (id: string) => void;
}

function formatTimestamp(timestamp: string): string {
  try {
    return format(new Date(timestamp), 'yyyy-MM-dd HH:mm', { locale: zhCN });
  } catch {
    return timestamp;
  }
}

function VersionDropdownComp(props: VersionDropdownProps): React.ReactElement {
  const { versions, selectedId, loading, onChange } = props;

  const options = useMemo(
    () =>
      versions.map((v) => ({
        label: `${v.version_label}  ·  ${formatTimestamp(v.timestamp)}`,
        value: v.id,
      })),
    [versions],
  );

  return (
    <Select
      style={{ minWidth: 260, maxWidth: 360 }}
      placeholder="选择版本"
      value={selectedId ?? undefined}
      loading={loading}
      options={options}
      onChange={(value) => onChange(String(value))}
    />
  );
}

export const VersionDropdown = memo(VersionDropdownComp);
