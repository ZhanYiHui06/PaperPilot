import { memo, type ReactNode } from 'react';
import { Button, Tooltip } from '@lobehub/ui';
import { Play, Save, SaveAll } from 'lucide-react';
import { useTheme } from 'antd-style';

interface EditorToolbarProps {
  onCompile: () => void;
  onSave: () => void;
  onSaveVersion: () => void;
  saving?: boolean;
  savingVersion?: boolean;
  compiling?: boolean;
  versionSelector?: ReactNode;
  extraButtons?: ReactNode;
}

function EditorToolbarComp(props: EditorToolbarProps): React.ReactElement {
  const {
    onCompile,
    onSave,
    onSaveVersion,
    saving,
    savingVersion,
    compiling,
    versionSelector,
    extraButtons,
  } = props;
  const theme = useTheme();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 16px',
        border: `1px solid ${theme.colorBorderSecondary}`,
        borderRadius: 8,
        marginBottom: 12,
        background: theme.colorBgContainer,
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      <Tooltip title={compiling ? '正在编译…' : '编译 LaTeX 文档'}>
        <Button icon={<Play size={16} />} loading={compiling} onClick={onCompile}>
          编译
        </Button>
      </Tooltip>

      <Tooltip title="保存文件 (Ctrl+S)">
        <Button
          icon={<Save size={16} />}
          loading={saving}
          onClick={onSave}
        >
          保存
        </Button>
      </Tooltip>

      <div style={{ flex: 1 }} />

      {extraButtons}

      {versionSelector}

      <Tooltip title="保存当前内容为新版本记录">
        <Button
          type="primary"
          icon={<SaveAll size={16} />}
          loading={savingVersion}
          onClick={onSaveVersion}
        >
          记录版本
        </Button>
      </Tooltip>
    </div>
  );
}

export const EditorToolbar = memo(EditorToolbarComp);
