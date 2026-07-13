import { Button, Select, toast } from '@lobehub/ui';
import { Card, Tag, Tooltip } from 'antd';
import { useTheme } from 'antd-style';
import { useEffect, useState } from 'react';
import { Cpu, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import type { LatexEngineInfo, LatexEngineType } from '@shared/types';

// All selectable engines, in display order.
const ENGINE_OPTIONS: Array<{ value: LatexEngineType; label: string }> = [
  { value: 'tectonic', label: 'Tectonic (内置，自动下载)' },
  { value: 'pdflatex', label: 'pdfLaTeX (系统)' },
  { value: 'xelatex', label: 'XeLaTeX (系统)' },
  { value: 'lualatex', label: 'LuaLaTeX (系统)' },
];

const ENGINE_HINTS: Record<LatexEngineType, string> = {
  tectonic: '基于 XeTeX 的自包含引擎，无需安装 TeX 发行版。不支持显式要求 pdfTeX 的模板（如 AAAI 2027）。',
  pdflatex: '标准 pdfTeX 引擎，兼容绝大多数会议模板。需安装 TeX Live / MiKTeX 并加入 PATH。',
  xelatex: '支持 Unicode 和系统字体的引擎，适合中文排版。需安装 TeX 发行版。',
  lualatex: '支持 Lua 脚本扩展的引擎，字体处理灵活。需安装 TeX 发行版。',
};

export function LatexEngineSection(): React.ReactElement {
  const theme = useTheme();
  const [engine, setEngine] = useState<LatexEngineType>('tectonic');
  const [systemEngines, setSystemEngines] = useState<LatexEngineInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load current engine config + detect system engines on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [current, detected] = await Promise.all([
          window.api.latex.getEngineConfig(),
          window.api.latex.detectSystemEngines(),
        ]);
        if (cancelled) return;
        setEngine(current);
        setSystemEngines(detected);
      } catch (e) {
        if (!cancelled) {
          toast.error({
            title: '加载 LaTeX 引擎配置失败',
            description: e instanceof Error ? e.message : String(e),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDetect = async (): Promise<void> => {
    try {
      setDetecting(true);
      const detected = await window.api.latex.detectSystemEngines();
      setSystemEngines(detected);
      const availableCount = detected.filter((e) => e.available).length;
      if (availableCount > 0) {
        toast.success({
          title: '检测完成',
          description: `发现 ${availableCount} 个可用系统引擎`,
        });
      } else {
        toast.warning({
          title: '未检测到系统 TeX 引擎',
          description: '请安装 TeX Live / MiKTeX 并确保加入 PATH',
        });
      }
    } catch (e) {
      toast.error({
        title: '检测失败',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setDetecting(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    try {
      setSaving(true);
      await window.api.latex.setEngineConfig(engine);
      toast.success({
        title: '引擎已切换',
        description: `当前编译引擎：${ENGINE_OPTIONS.find((o) => o.value === engine)?.label ?? engine}`,
      });
    } catch (e) {
      toast.error({
        title: '保存失败',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEngineChange = (value: LatexEngineType): void => {
    setEngine(value);
  };

  if (loading) return null;

  // Build a quick lookup of system engine availability.
  const systemEngineMap = new Map(systemEngines.map((e) => [e.name, e]));

  return (
    <Card
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Cpu size={16} />
          LaTeX 编译引擎
        </span>
      }
      style={{
        marginBottom: 12,
        borderRadius: theme.borderRadiusLG ?? 12,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <Select
          value={engine}
          options={ENGINE_OPTIONS}
          onChange={handleEngineChange}
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
          {ENGINE_HINTS[engine]}
        </div>
      </div>

      {/* System engine availability list */}
      <div
        style={{
          marginBottom: 12,
          padding: 12,
          background: theme.colorFillQuaternary,
          borderRadius: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: theme.colorText }}>
            系统 TeX 引擎检测
          </span>
          <Tooltip title="重新检测 PATH 中的 TeX 引擎">
            <Button
              size="small"
              type="text"
              icon={<RefreshCw size={14} />}
              loading={detecting}
              onClick={() => {
                void handleDetect();
              }}
            />
          </Tooltip>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {systemEngines.map((info) => (
            <div
              key={info.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
              }}
            >
              {info.available ? (
                <CheckCircle2 size={14} color={theme.colorSuccess} />
              ) : (
                <XCircle size={14} color={theme.colorTextTertiary} />
              )}
              <span style={{ fontWeight: 500, color: theme.colorText }}>
                {info.name}
              </span>
              {info.available ? (
                <>
                  <Tag color="success" style={{ margin: 0, fontSize: 11 }}>
                    可用
                  </Tag>
                  {info.version && (
                    <span
                      style={{
                        color: theme.colorTextTertiary,
                        fontSize: 11,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                      title={info.version}
                    >
                      {info.version}
                    </span>
                  )}
                </>
              ) : (
                <span style={{ color: theme.colorTextTertiary, fontSize: 11 }}>
                  未安装
                </span>
              )}
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: theme.colorTextTertiary,
            lineHeight: 1.5,
          }}
        >
          系统引擎需要安装 TeX Live / MiKTeX / MacTeX 并加入 PATH。
          如遇「pdfTeX is required」错误，请切换到 pdfLaTeX。
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          type="primary"
          loading={saving}
          onClick={() => {
            void handleSave();
          }}
        >
          保存
        </Button>
        <Button
          icon={<RefreshCw size={14} />}
          loading={detecting}
          onClick={() => {
            void handleDetect();
          }}
        >
          重新检测
        </Button>
      </div>
    </Card>
  );
}
