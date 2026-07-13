import { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button, Collapse } from 'antd';
import { RefreshCw, Home } from 'lucide-react';
import { useTheme } from 'antd-style';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorFallbackProps {
  error: Error | null;
  onReload: () => void;
  onHome: () => void;
}

function ErrorFallback({ error, onReload, onHome }: ErrorFallbackProps): React.ReactElement {
  const theme = useTheme();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme.colorBgLayout,
        padding: 24,
      }}
    >
      <Result
        status="error"
        title="页面出错了"
        subTitle={error?.message ?? '发生未知错误'}
        extra={[
          <Button
            key="reload"
            type="primary"
            icon={<RefreshCw size={16} />}
            onClick={onReload}
          >
            刷新页面
          </Button>,
          <Button key="home" icon={<Home size={16} />} onClick={onHome}>
            返回首页
          </Button>,
        ]}
      />
      {error?.stack && (
        <div style={{ width: '100%', maxWidth: 800 }}>
          <Collapse
            items={[
              {
                key: 'stack',
                label: '错误堆栈',
                children: (
                  <pre
                    style={{
                      margin: 0,
                      overflow: 'auto',
                      fontSize: 12,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: theme.colorTextSecondary,
                    }}
                  >
                    {error.stack}
                  </pre>
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <ErrorFallback
        error={this.state.error}
        onReload={this.handleReload}
        onHome={this.handleGoHome}
      />
    );
  }
}
