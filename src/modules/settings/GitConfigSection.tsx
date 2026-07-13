import { Form, FormItem, Input, Button, toast } from '@lobehub/ui';
import { Card } from 'antd';
import { useTheme } from 'antd-style';
import { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import type { GitConfig } from '@shared/types';

const DEFAULT_GIT_CONFIG: Partial<GitConfig> = {
  default_repo_path: '',
};

export function GitConfigSection(): React.ReactElement {
  const [form] = Form.useForm<GitConfig>();
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const theme = useTheme();

  // Load config from DB on mount — pre-fill form via setFieldsValue (NOT initialValue)
  useEffect(() => {
    let cancelled = false;
    window.api.db.gitConfig
      .get()
      .then((config) => {
        if (cancelled) return;
        form.setFieldsValue(config ?? DEFAULT_GIT_CONFIG);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoading(false);
        toast.error({
          title: '加载 Git 配置失败',
          description: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [form]);

  const handleSave = async (values: GitConfig): Promise<void> => {
    try {
      await window.api.db.gitConfig.save(values);
      toast.success({ title: 'Git 配置已保存' });
    } catch (e: unknown) {
      toast.error({
        title: '保存失败',
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handlePickDirectory = async (): Promise<void> => {
    try {
      setPicking(true);
      const dir = await window.api.dialog.openDirectory();
      if (dir) {
        form.setFieldsValue({ default_repo_path: dir });
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

  if (loading) return null;

  return (
    <Card
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FolderOpen size={16} />
          Git 配置
        </span>
      }
      style={{
        marginBottom: 12,
        borderRadius: theme.borderRadiusLG ?? 12,
      }}
    >
      <Form
        form={form}
        layout="vertical"
        variant="filled"
        onFinish={(values) => {
          void handleSave(values);
        }}
      >
        <FormItem name="default_repo_path" label="默认仓库路径">
          <Input
            placeholder="点击右侧按钮选择目录"
            readOnly
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
        </FormItem>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Button type="primary" htmlType="submit">
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
        </div>
      </Form>
    </Card>
  );
}
