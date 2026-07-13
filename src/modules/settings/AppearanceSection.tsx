import { Form, FormItem, Button, Segmented, toast } from '@lobehub/ui';
import { Card } from 'antd';
import { useTheme } from 'antd-style';
import { useEffect, useState } from 'react';
import { Palette } from 'lucide-react';
import type { AppConfig } from '@shared/types';
import { useUIStore } from '@renderer/stores/uiStore';

type ThemeValue = 'light' | 'dark';

const THEME_OPTIONS: Array<{ label: string; value: ThemeValue }> = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
];

const DEFAULT_APP_CONFIG: AppConfig = {
  theme: 'light',
};

export function AppearanceSection(): React.ReactElement {
  const [form] = Form.useForm<AppConfig>();
  const [loading, setLoading] = useState(true);
  const theme = useTheme();
  const setThemeMode = useUIStore((s) => s.setThemeMode);

  // Load config from DB on mount — pre-fill form via setFieldsValue (NOT initialValue)
  useEffect(() => {
    let cancelled = false;
    window.api.db.appConfig
      .get()
      .then((config) => {
        if (cancelled) return;
        const merged = { ...DEFAULT_APP_CONFIG, ...(config ?? {}) };
        form.setFieldsValue(merged);
        // Keep the global store in sync with the persisted value on first load.
        setThemeMode(merged.theme);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoading(false);
        toast.error({
          title: '加载外观配置失败',
          description: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [form, setThemeMode]);

  const handleSave = async (values: AppConfig): Promise<void> => {
    try {
      await window.api.db.appConfig.save(values);
      // Apply the theme immediately so the user sees the change without reload.
      setThemeMode(values.theme);
      toast.success({ title: '外观配置已保存' });
    } catch (e: unknown) {
      toast.error({
        title: '保存失败',
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  if (loading) return null;

  return (
    <Card
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Palette size={16} />
          外观
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
        <FormItem name="theme" label="主题">
          <Segmented
            options={THEME_OPTIONS}
            onChange={(value) => setThemeMode(value as ThemeValue)}
          />
        </FormItem>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Button type="primary" htmlType="submit">
            保存
          </Button>
        </div>
      </Form>
    </Card>
  );
}
