import { Form, FormItem, Input, InputPassword, InputNumber, Button, Select, toast } from '@lobehub/ui';
import { Card, Popconfirm, Switch } from 'antd';
import { useTheme } from 'antd-style';
import { useEffect, useState } from 'react';
import { Mail, Trash } from 'lucide-react';
import type { EmailConfig, EmailSyncDays } from '@shared/types';

// Default values per spec Section 4.9.2 (used when no DB config exists)
const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  host: '',
  port: 993,
  username: '',
  password: '',
  ssl: 1,
  sync_days: 30,
};

const SYNC_DAYS_OPTIONS: Array<{ label: string; value: EmailSyncDays }> = [
  { label: '最近 7 天', value: 7 },
  { label: '最近 30 天', value: 30 },
  { label: '最近 90 天', value: 90 },
  { label: '最近 180 天', value: 180 },
  { label: '最近 1 年', value: 365 },
];

export function EmailConfigSection(): React.ReactElement {
  const [form] = Form.useForm<EmailConfig>();
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [syncDays, setSyncDays] = useState<EmailSyncDays>(30);
  const theme = useTheme();

  // Load config from DB on mount — pre-fill form via setFieldsValue (NOT initialValue)
  useEffect(() => {
    let cancelled = false;
    window.api.db.emailConfig
      .get()
      .then((config) => {
        if (cancelled) return;
        if (config) {
          form.setFieldsValue(config);
          setSyncDays(config.sync_days ?? 30);
          setHasConfig(true);
        } else {
          form.setFieldsValue(DEFAULT_EMAIL_CONFIG);
          setSyncDays(30);
          setHasConfig(false);
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoading(false);
        toast.error({
          title: '加载邮箱配置失败',
          description: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [form]);

  const handleSave = async (values: EmailConfig): Promise<void> => {
    try {
      await window.api.db.emailConfig.save({ ...values, sync_days: syncDays });
      setHasConfig(true);
      toast.success({ title: '邮箱配置已保存' });
    } catch (e: unknown) {
      toast.error({
        title: '保存失败',
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleTestConnection = async (): Promise<void> => {
    try {
      const values = await form.validateFields();
      setTesting(true);
      const result = await window.api.email.testConnection({ ...values, sync_days: syncDays });
      if (result.success) {
        toast.success({ title: '连接成功', description: result.message });
      } else {
        toast.error({ title: '连接失败', description: result.message });
      }
    } catch (e: unknown) {
      // validateFields throws when fields are invalid (returns { errorFields })
      if (e && typeof e === 'object' && 'errorFields' in e) {
        toast.error({ title: '请填写完整', description: '请补全所有必填字段后再测试' });
      } else {
        toast.error({
          title: '连接失败',
          description: e instanceof Error ? e.message : String(e),
        });
      }
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    try {
      setDeleting(true);
      await window.api.db.emailConfig.delete();
      form.setFieldsValue(DEFAULT_EMAIL_CONFIG);
      setSyncDays(30);
      setHasConfig(false);
      toast.success({ title: '邮箱配置已删除' });
    } catch (e: unknown) {
      toast.error({
        title: '删除失败',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return null;

  return (
    <Card
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Mail size={16} />
          邮箱配置（IMAP）
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
        <FormItem name="host" label="IMAP 主机" rules={[{ required: true, message: '请输入 IMAP 主机地址' }]}>
          <Input placeholder="imap.example.com" />
        </FormItem>
        <FormItem name="port" label="IMAP 端口" rules={[{ required: true, message: '请输入端口号' }]}>
          <InputNumber min={1} max={65535} style={{ width: '100%' }} />
        </FormItem>
        <FormItem name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
          <Input placeholder="user@example.com" autoComplete="off" />
        </FormItem>
        <FormItem name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
          <InputPassword placeholder="••••••••" autoComplete="off" />
        </FormItem>
        <FormItem name="ssl" label="SSL/TLS" valuePropName="checked" getValueFromEvent={(checked: boolean) => (checked ? 1 : 0)} getValueProps={(v) => ({ checked: v === 1 })}>
          <Switch />
        </FormItem>
      </Form>

      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            marginBottom: 8,
            fontSize: 14,
            color: theme.colorText,
            lineHeight: 1.5714285714285714,
          }}
        >
          同步时间范围
        </div>
        <Select
          value={syncDays}
          options={SYNC_DAYS_OPTIONS}
          onChange={(value) => setSyncDays(value as EmailSyncDays)}
          style={{ width: '100%' }}
          virtual={false}
        />
        <div
          style={{
            fontSize: 12,
            color: theme.colorTextSecondary,
            marginTop: 6,
            lineHeight: 1.6,
          }}
        >
          仅拉取该时间范围内的邮件；已入库的邮件会跳过正文下载与 AI 分类
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
        <Button
          type="primary"
          onClick={() => {
            const values = form.getFieldsValue();
            void handleSave(values);
          }}
        >
          保存
        </Button>
        <Button
          icon={<Mail size={16} />}
          loading={testing}
          onClick={() => {
            void handleTestConnection();
          }}
        >
          测试连接
        </Button>
        {hasConfig && (
          <Popconfirm
            title="删除邮箱配置"
            description="确定要删除当前邮箱配置吗？此操作不可撤销。"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true, loading: deleting }}
            onConfirm={() => {
              void handleDelete();
            }}
          >
            <Button danger icon={<Trash size={16} />}>
              删除配置
            </Button>
          </Popconfirm>
        )}
      </div>
    </Card>
  );
}
