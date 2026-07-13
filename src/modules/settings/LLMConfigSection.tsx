import { Form, FormItem, Input, InputPassword, Button, Select, toast } from '@lobehub/ui';
import { Card } from 'antd';
import { useTheme } from 'antd-style';
import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import type { LLMConfig } from '@shared/types';

// ============ Provider 预设 ============
// Base URL 已全网核实，参见各 provider 官方文档
// 所有预设均走 OpenAI ChatCompletions 兼容协议
interface ProviderPreset {
  label: string;
  value: string;
  baseUrl: string;
  defaultModel: string;
  group: 'international' | 'china' | 'local' | 'custom';
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  // 国际
  {
    label: 'OpenAI',
    value: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    group: 'international',
  },
  {
    label: 'Anthropic Claude (OpenAI 兼容层)',
    value: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1/',
    defaultModel: 'claude-sonnet-4-5',
    group: 'international',
  },
  {
    label: 'Google Gemini (OpenAI 兼容)',
    value: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    group: 'international',
  },
  {
    label: 'Mistral AI',
    value: 'mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    group: 'international',
  },
  {
    label: 'OpenRouter',
    value: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    group: 'international',
  },
  {
    label: 'Together AI',
    value: 'together',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    group: 'international',
  },
  {
    label: 'Groq',
    value: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    group: 'international',
  },
  {
    label: 'Fireworks AI',
    value: 'fireworks',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    group: 'international',
  },
  {
    label: 'GitHub Models',
    value: 'github',
    baseUrl: 'https://models.inference.ai.azure.com',
    defaultModel: 'gpt-4o-mini',
    group: 'international',
  },
  // 国内
  {
    label: 'DeepSeek',
    value: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    group: 'china',
  },
  {
    label: '阿里云百炼 (Qwen)',
    value: 'dashscope',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    group: 'china',
  },
  {
    label: '月之暗面 Kimi',
    value: 'moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    group: 'china',
  },
  {
    label: '智谱 GLM',
    value: 'zhipu',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    group: 'china',
  },
  {
    label: '硅基流动 SiliconFlow',
    value: 'siliconflow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'deepseek-ai/DeepSeek-V3',
    group: 'china',
  },
  {
    label: '火山方舟 (豆包)',
    value: 'volcengine',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-pro-32k',
    group: 'china',
  },
  {
    label: 'MiniMax',
    value: 'minimax',
    baseUrl: 'https://api.minimax.chat/v1',
    defaultModel: 'abab6.5s-chat',
    group: 'china',
  },
  {
    label: '百度千帆',
    value: 'qianfan',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    defaultModel: 'ernie-4.0-8k-latest',
    group: 'china',
  },
  // 本地
  {
    label: 'Ollama (本地)',
    value: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.1',
    group: 'local',
  },
  // 自定义（OpenAI 兼容协议，用户自填 base URL）
  {
    label: 'OpenAI Compatible (自定义)',
    value: 'openai-compatible',
    baseUrl: '',
    defaultModel: '',
    group: 'custom',
  },
];

const CUSTOM_PROVIDER_VALUE = 'openai-compatible';

// 分组的 Select options
const PROVIDER_OPTION_GROUPS = [
  {
    label: '国际',
    options: PROVIDER_PRESETS.filter((p) => p.group === 'international'),
  },
  {
    label: '国内',
    options: PROVIDER_PRESETS.filter((p) => p.group === 'china'),
  },
  {
    label: '本地',
    options: PROVIDER_PRESETS.filter((p) => p.group === 'local'),
  },
  {
    label: '自定义',
    options: PROVIDER_PRESETS.filter((p) => p.group === 'custom'),
  },
].map((group) => ({
  label: group.label,
  options: group.options.map((p) => ({ label: p.label, value: p.value })),
}));

// Defaults used when no config exists in DB yet (per spec Section 4.9.1)
// API key is NOT hardcoded here — it's seeded by the main process (database/db.ts)
// and loaded via IPC. Renderer must never bundle real credentials.
const DEFAULT_LLM_CONFIG: Partial<LLMConfig> = {
  provider: 'deepseek',
  api_key: '',
  model: 'deepseek-chat',
  base_url: 'https://api.deepseek.com/v1',
};

export function LLMConfigSection(): React.ReactElement {
  const [form] = Form.useForm<LLMConfig>();
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  // 同步当前选中的 provider，用于决定是否显示 Base URL 输入框
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const isCustomProvider = selectedProvider === CUSTOM_PROVIDER_VALUE;
  const theme = useTheme();

  // Load config from DB on mount — pre-fill form via setFieldsValue (NOT initialValue)
  useEffect(() => {
    let cancelled = false;
    window.api.db.llmConfig
      .get()
      .then((config) => {
        if (cancelled) return;
        const merged = config ?? DEFAULT_LLM_CONFIG;
        form.setFieldsValue(merged);
        setSelectedProvider(merged.provider ?? '');
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoading(false);
        toast.error({
          title: '加载 LLM 配置失败',
          description: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [form]);

  // 用户主动切换 provider 时，自动填充对应的 base URL 和默认 model
  // 仅在用户主动切换时触发（不在初次加载时触发，避免覆盖已保存配置）
  const handleProviderChange = (value: string): void => {
    setSelectedProvider(value);
    const preset = PROVIDER_PRESETS.find((p) => p.value === value);
    if (!preset) return;
    if (value === CUSTOM_PROVIDER_VALUE) {
      // 自定义模式：清空 base URL，让用户填写
      form.setFieldValue('base_url', '');
      form.setFieldValue('model', '');
    } else {
      // 预设模式：填充 base URL 和默认 model
      form.setFieldValue('base_url', preset.baseUrl);
      form.setFieldValue('model', preset.defaultModel);
    }
  };

  const handleSave = async (values: LLMConfig): Promise<void> => {
    try {
      await window.api.db.llmConfig.update(values);
      toast.success({ title: 'LLM 配置已保存' });
    } catch (e: unknown) {
      toast.error({
        title: '保存失败',
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleTestConnection = async (): Promise<void> => {
    try {
      setTesting(true);
      const result = await window.api.llm.testConnection();
      if (result.success) {
        toast.success({ title: '连接成功', description: result.message });
      } else {
        toast.error({ title: '连接失败', description: result.message });
      }
    } catch (e: unknown) {
      toast.error({
        title: '连接失败',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return null;

  return (
    <Card
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Zap size={16} />
          LLM 配置
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
        <FormItem name="provider" label="服务商">
          <Select
            options={PROVIDER_OPTION_GROUPS}
            virtual={false}
            onChange={handleProviderChange}
          />
        </FormItem>
        <FormItem name="api_key" label="API Key">
          <InputPassword placeholder="sk-..." autoComplete="off" />
        </FormItem>
        <FormItem name="model" label="模型">
          <Input placeholder="deepseek-chat" />
        </FormItem>
        {/* 仅在「OpenAI Compatible (自定义)」模式下显示 Base URL 输入框
            预设 provider 的 base URL 在切换时自动填充，用户无需手动设置 */}
        <FormItem
          name="base_url"
          label="接口地址"
          style={{ display: isCustomProvider ? undefined : 'none' }}
        >
          <Input placeholder="https://api.example.com/v1" />
        </FormItem>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Button type="primary" htmlType="submit">
            保存
          </Button>
          <Button
            icon={<Zap size={16} />}
            loading={testing}
            onClick={() => {
              void handleTestConnection();
            }}
          >
            测试连接
          </Button>
        </div>
      </Form>
    </Card>
  );
}
