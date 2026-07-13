import { memo, useState } from 'react';
import { motion } from 'motion/react';
import { Button, Empty, Markdown, NeuralNetworkLoading, Skeleton, Tag } from '@lobehub/ui';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Lightbulb,
  Loader2,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { useTheme } from 'antd-style';
import type { LatexEngineProgress, LatexEngineStatus, LatexEngineType } from '@shared/types';

export type CompilePhase = 'idle' | 'compiling' | 'success' | 'error';

export interface PreviewPanelProps {
  engineStatus: LatexEngineStatus | null;
  engineType: LatexEngineType;
  engineInstalling: boolean;
  engineProgress: LatexEngineProgress[];
  engineError: string | null;
  compilePhase: CompilePhase;
  compileLog: string;
  compileErrors: string[];
  pdfBase64: string | null;
  errorAnalysis?: string;
  analyzingError?: boolean;
  onInstallEngine: () => void;
  onRetryCompile: () => void;
}

function PreviewPanelComp(props: PreviewPanelProps): React.ReactElement {
  const {
    engineStatus,
    engineType,
    engineInstalling,
    engineProgress,
    engineError,
    compilePhase,
    compileLog,
    compileErrors,
    pdfBase64,
    errorAnalysis,
    analyzingError,
    onInstallEngine,
    onRetryCompile,
  } = props;
  const theme = useTheme();
  const [showLog, setShowLog] = useState(false);

  const engineInstalled = engineStatus?.installed === true;
  const lastProgress = engineProgress[engineProgress.length - 1];

  // ---- 1. Engine not installed / installing ----
  // Only show the Tectonic install screen when Tectonic is the selected engine.
  // System engines (pdflatex/xelatex/lualatex) don't need Tectonic installed.
  if (engineType === 'tectonic' && (!engineInstalled || engineInstalling)) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          background: theme.colorBgLayout,
        }}
      >
        {engineInstalling ? (
          <>
            <NeuralNetworkLoading size={120} />
            <div style={{ fontSize: 14, color: theme.colorTextSecondary, textAlign: 'center' }}>
              {lastProgress?.message ?? '正在准备 LaTeX 引擎…'}
            </div>
            {lastProgress?.stage === 'download' && typeof lastProgress.percent === 'number' && (
              <div
                style={{
                  width: 240,
                  height: 4,
                  background: theme.colorBorderSecondary,
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${lastProgress.percent}%`,
                    height: '100%',
                    background: theme.colorPrimary,
                    transition: 'width 0.2s ease-out',
                  }}
                />
              </div>
            )}
            {engineError && (
              <div
                style={{
                  maxWidth: 360,
                  padding: 12,
                  background: theme.colorErrorBg,
                  border: `1px solid ${theme.colorErrorBorder}`,
                  borderRadius: 8,
                  color: theme.colorErrorText,
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {engineError}
              </div>
            )}
          </>
        ) : (
          <>
            <Empty
              icon={Download}
              title="尚未安装 LaTeX 引擎"
              description="编译功能需要 Tectonic 引擎。点击下方按钮下载并安装（约 30 MB，首次编译会按需下载宏包）。"
              type="default"
              action={
                <Button
                  type="primary"
                  icon={<Download size={16} />}
                  onClick={onInstallEngine}
                >
                  安装 Tectonic 引擎
                </Button>
              }
            />
          </>
        )}
      </div>
    );
  }

  // ---- 2. Compiling in progress ----
  if (compilePhase === 'compiling') {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: theme.colorBgLayout,
        }}
      >
        <div
          style={{
            padding: '24px 24px 12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <NeuralNetworkLoading size={96} />
          <div style={{ fontSize: 13, color: theme.colorTextSecondary }}>
            正在编译…首次编译会下载所需宏包，请耐心等待
          </div>
        </div>
        <LogPane log={compileLog} theme={theme} />
      </div>
    );
  }

  // ---- 3. Compile error ----
  if (compilePhase === 'error') {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: theme.colorBgLayout,
        }}
      >
        <div
          style={{
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            flex: '0 1 auto',
            overflow: 'auto',
            minHeight: 0,
            borderBottom: `1px solid ${theme.colorErrorBorder}`,
            background: theme.colorErrorBg,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} color={theme.colorErrorText} />
            <span style={{ fontSize: 14, fontWeight: 600, color: theme.colorErrorText }}>
              编译失败
            </span>
            <Button
              size="small"
              icon={<RefreshCw size={14} />}
              onClick={onRetryCompile}
              style={{ marginLeft: 'auto' }}
            >
              重试
            </Button>
          </div>
          {compileErrors.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {compileErrors.slice(0, 8).map((err, i) => (
                <Tag
                  key={i}
                  color="error"
                  style={{ alignSelf: 'flex-start', maxWidth: '100%' }}
                >
                  {err}
                </Tag>
              ))}
            </div>
          )}
          {/* LLM error analysis */}
          {(analyzingError || errorAnalysis) && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                padding: '10px 12px',
                background: theme.colorBgContainer,
                border: `1px solid ${theme.colorBorderSecondary}`,
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.6,
                color: theme.colorText,
              }}
            >
              <Lightbulb size={16} style={{ flexShrink: 0, color: theme.colorPrimary, marginTop: 2 }} />
              {analyzingError ? (
                <span style={{ color: theme.colorTextSecondary, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  正在分析失败原因…
                </span>
              ) : (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Markdown variant="chat" fontSize={13}>
                    {errorAnalysis ?? ''}
                  </Markdown>
                </div>
              )}
            </div>
          )}
          <Button
            size="small"
            type="text"
            icon={<Terminal size={14} />}
            onClick={() => setShowLog((v) => !v)}
            style={{ alignSelf: 'flex-start' }}
          >
            {showLog ? '隐藏编译日志' : '查看完整编译日志'}
          </Button>
        </div>
        <motion.div
          animate={{
            opacity: showLog ? 1 : 0,
          }}
          transition={{
            opacity: { duration: showLog ? 0.2 : 0.1, ease: [0.4, 0, 0.2, 1] },
          }}
          style={{ overflow: 'hidden', flex: showLog ? 1 : 0, minHeight: 0, display: 'flex', flexDirection: 'column', willChange: 'opacity, flex' }}
        >
          {showLog && <LogPane log={compileLog} theme={theme} />}
        </motion.div>
      </div>
    );
  }

  // ---- 4. Compile success — show PDF ----
  if (compilePhase === 'success' && pdfBase64) {
    const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: theme.colorBgLayout,
        }}
      >
        <div
          style={{
            padding: '0 12px',
            height: 40,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: `1px solid ${theme.colorBorderSecondary}`,
            background: theme.colorBgContainer,
            flexShrink: 0,
          }}
        >
          <CheckCircle2 size={14} color={theme.colorSuccess} />
          <span style={{ fontSize: 12, color: theme.colorTextSecondary }}>编译成功</span>
          <Button
            size="small"
            type="text"
            icon={<Terminal size={12} />}
            onClick={() => setShowLog((v) => !v)}
            style={{ marginLeft: 'auto' }}
          >
            {showLog ? '隐藏日志' : '查看日志'}
          </Button>
        </div>
        <motion.div
          animate={{
            opacity: showLog ? 1 : 0,
          }}
          transition={{
            opacity: { duration: showLog ? 0.2 : 0.1, ease: [0.4, 0, 0.2, 1] },
          }}
          style={{ overflow: 'hidden', flex: showLog ? 1 : 0, minHeight: 0, display: 'flex', flexDirection: 'column', willChange: 'opacity, flex' }}
        >
          {showLog && <LogPane log={compileLog} theme={theme} />}
        </motion.div>
        {!showLog && (
          <iframe
            title="PDF Preview"
            src={pdfDataUrl}
            style={{
              flex: 1,
              width: '100%',
              border: 'none',
              background: theme.colorBgContainer,
            }}
          />
        )}
      </div>
    );
  }

  // ---- 5. Idle ----
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme.colorBgLayout,
        padding: 24,
      }}
    >
      <Empty
        icon={FileText}
        title="尚未编译"
        description="点击工具栏的「编译」按钮生成 PDF 预览。"
        type="default"
      />
    </div>
  );
}

interface LogPaneProps {
  log: string;
  theme: ReturnType<typeof useTheme>;
}

function LogPane({ log, theme }: LogPaneProps): React.ReactElement {
  if (!log) {
    return (
      <div
        style={{
          flex: 1,
          margin: 12,
          padding: 12,
          border: `1px solid ${theme.colorBorderSecondary}`,
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <Skeleton active />
      </div>
    );
  }
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        margin: 12,
        border: `1px solid ${theme.colorBorderSecondary}`,
        borderRadius: 8,
        overflow: 'hidden',
        background: theme.colorFillQuaternary,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {(() => {
        const lines = log.split('\n');
        if (lines.length <= 200) {
          return (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                padding: 12,
                overflow: 'auto',
                fontFamily:
                  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                fontSize: 12,
                lineHeight: 1.6,
                color: theme.colorText,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {log}
            </div>
          );
        }
        const visibleLines = lines.slice(0, 200);
        return (
          <>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                padding: 12,
                overflow: 'auto',
                fontFamily:
                  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                fontSize: 12,
                lineHeight: 1.6,
                color: theme.colorText,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {visibleLines.join('\n')}
            </div>
            <div
              style={{
                padding: '8px 12px',
                color: theme.colorTextTertiary,
                fontSize: 12,
                textAlign: 'center',
                borderTop: `1px solid ${theme.colorBorderSecondary}`,
                flexShrink: 0,
              }}
            >
              … (省略 {lines.length - 200} 行)
            </div>
          </>
        );
      })()}
    </div>
  );
}

export const PreviewPanel = memo(PreviewPanelComp);
