import { Button, Input, toast } from '@lobehub/ui';
import { Card } from 'antd';
import { useTheme } from 'antd-style';
import { useEffect, useState } from 'react';
import { FolderOpen, RotateCcw, FileText } from 'lucide-react';

export function LatexStorageSection(): React.ReactElement {
  const theme = useTheme();
  const [path, setPath] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.api.latex
      .getStoragePath()
      .then((result) => {
        if (cancelled) return;
        setPath(result.path);
        setIsCustom(result.isCustom);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoading(false);
        toast.error({
          title: '加载 LaTeX 存储路径失败',
          description: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePickDirectory = async (): Promise<void> => {
    try {
      setPicking(true);
      const dir = await window.api.dialog.openDirectory();
      if (dir) {
        setPath(dir);
        setIsCustom(true);
      }
    } catch (e: unknown) {
      toast.error({
        title: '选择目录失败',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setPicking(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    try {
      setSaving(true);
      const result = await window.api.latex.setStoragePath(isCustom ? path : null);
      setPath(result.path);
      setIsCustom(result.isCustom);
      toast.success({ title: 'LaTeX 存储路径已保存' });
    } catch (e: unknown) {
      toast.error({
        title: '保存失败',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (): Promise<void> => {
    try {
      setSaving(true);
      const result = await window.api.latex.setStoragePath(null);
      setPath(result.path);
      setIsCustom(false);
      toast.success({ title: '已恢复默认存储路径', description: result.path });
    } catch (e: unknown) {
      toast.error({
        title: '重置失败',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Card
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FileText size={16} />
          LaTeX 项目存储
        </span>
      }
      style={{
        marginBottom: 12,
        borderRadius: theme.borderRadiusLG ?? 12,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <Input
          value={path}
          readOnly
          placeholder="未设置存储路径"
          suffix={
            <Button
              size="small"
              type="text"
              icon={<FolderOpen size={16} />}
              loading={picking}
              onClick={() => {
                void handlePickDirectory();
              }}
            />
          }
        />
        <div
          style={{
            fontSize: 12,
            color: theme.colorTextSecondary,
            marginTop: 6,
            lineHeight: 1.6,
          }}
        >
          {isCustom
            ? '当前使用自定义存储路径。导入的 LaTeX 模板压缩包将解压到此目录下。'
            : '当前使用默认存储路径。点击下方「选择目录」可自定义。'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          type="primary"
          loading={saving}
          disabled={!isCustom || !path}
          onClick={() => {
            void handleSave();
          }}
        >
          保存
        </Button>
        <Button
          icon={<FolderOpen size={16} />}
          loading={picking}
          onClick={() => {
            void handlePickDirectory();
          }}
        >
          选择目录
        </Button>
        <Button
          icon={<RotateCcw size={16} />}
          disabled={!isCustom}
          onClick={() => {
            void handleReset();
          }}
        >
          恢复默认
        </Button>
      </div>
    </Card>
  );
}
