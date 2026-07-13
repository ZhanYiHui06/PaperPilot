import { memo, useCallback } from 'react';
import { Input, Button } from '@lobehub/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useTheme } from 'antd-style';

export interface KeyValueEditorProps {
  /** Current value — injected by antd Form.Item when used inside a form */
  value?: Record<string, unknown> | null;
  /** Change handler — injected by antd Form.Item when used inside a form */
  onChange?: (value: Record<string, unknown> | null) => void;
  /** Placeholder for the key input */
  keyPlaceholder?: string;
  /** Placeholder for the value input */
  valuePlaceholder?: string;
}

interface EntryRow {
  key: string;
  value: string;
}

function toEntries(record: Record<string, unknown> | null | undefined): EntryRow[] {
  if (!record) return [];
  return Object.entries(record).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : String(value ?? ''),
  }));
}

function toRecord(entries: EntryRow[]): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};
  let hasAny = false;
  for (const entry of entries) {
    const trimmedKey = entry.key.trim();
    if (!trimmedKey) continue;
    // Last write wins for duplicate keys (matches typical key-value semantics)
    result[trimmedKey] = entry.value;
    hasAny = true;
  }
  return hasAny ? result : null;
}

function KeyValueEditorComp({
  value,
  onChange,
  keyPlaceholder = '参数名',
  valuePlaceholder = '参数值',
}: KeyValueEditorProps): React.ReactElement {
  const theme = useTheme();
  const entries = toEntries(value);

  const emit = useCallback(
    (next: EntryRow[]) => {
      onChange?.(toRecord(next));
    },
    [onChange],
  );

  const handleKeyChange = (index: number, newKey: string): void => {
    const next = entries.map((entry, i) => (i === index ? { ...entry, key: newKey } : entry));
    emit(next);
  };

  const handleValueChange = (index: number, newValue: string): void => {
    const next = entries.map((entry, i) => (i === index ? { ...entry, value: newValue } : entry));
    emit(next);
  };

  const handleDelete = (index: number): void => {
    const next = entries.filter((_, i) => i !== index);
    emit(next);
  };

  const handleAdd = (): void => {
    emit([...entries, { key: '', value: '' }]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.length === 0 && (
        <div
          style={{
            fontSize: 13,
            color: theme.colorTextTertiary,
            padding: '6px 0',
          }}
        >
          暂无条目，点击下方按钮添加
        </div>
      )}

      {entries.map((entry, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Input
            value={entry.key}
            placeholder={keyPlaceholder}
            onChange={(e) => handleKeyChange(index, e.target.value)}
            style={{ flex: 1 }}
          />
          <Input
            value={entry.value}
            placeholder={valuePlaceholder}
            onChange={(e) => handleValueChange(index, e.target.value)}
            style={{ flex: 1 }}
          />
          <Button
            icon={<Trash2 size={14} />}
            type="text"
            danger
            onClick={() => handleDelete(index)}
          />
        </div>
      ))}

      <div>
        <Button
          type="dashed"
          icon={<Plus size={14} />}
          onClick={handleAdd}
          size="small"
        >
          添加条目
        </Button>
      </div>
    </div>
  );
}

export const KeyValueEditor = memo(KeyValueEditorComp);
