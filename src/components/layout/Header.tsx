import { Button } from '@lobehub/ui';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'antd-style';
import iconBlack from '@renderer/assets/logo/icon_black.svg';
import iconWhite from '@renderer/assets/logo/icon_white.svg';
import { memo, useEffect, useState } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';

// Window control button — native-feeling, fills the header height.
// Close button turns red on hover; min/max use a subtle gray.
// Icons use stroke="currentColor" so the parent `color` CSS controls them.
function WindowButton({
  onClick,
  variant,
  title,
  isDark,
  color,
  children,
}: {
  onClick: () => void;
  variant: 'default' | 'close';
  title: string;
  isDark: boolean;
  color: string;
  children: React.ReactNode;
}): React.ReactElement {
  const [hovered, setHovered] = useState(false);
  const isClose = variant === 'close';

  // Theme-aware hover background
  let hoverBg = 'transparent';
  if (hovered) {
    hoverBg = isClose ? '#e81123' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  }

  // Close button shows white icon on red hover
  const iconColor = isClose && hovered ? '#fff' : color;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title}
      style={{
        width: 46,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'default',
        WebkitAppRegion: 'no-drag' as const,
        background: hoverBg,
        color: iconColor,
        transition: 'background 0.12s ease-out',
      }}
    >
      {children}
    </div>
  );
}

function HeaderComp(): React.ReactElement {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.appearance === 'dark';
  const logoSrc = isDark ? iconWhite : iconBlack;
  const [isMaximized, setIsMaximized] = useState(false);

  // Query initial maximized state + subscribe to changes
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    window.api.window
      .isMaximized()
      .then(setIsMaximized)
      .catch(() => undefined);
    unsubscribe = window.api.window.onMaximizeChange(setIsMaximized);
    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleMinimize = (): void => {
    window.api.window.minimize();
  };
  const handleMaximize = (): void => {
    window.api.window.maximize();
  };
  const handleClose = (): void => {
    window.api.window.close();
  };

  // lucide-react icons default to stroke="currentColor",
  // so the parent `color` CSS property controls the icon color.
  const buttonColor = theme.colorTextSecondary;

  return (
    <div
      style={{
        height: 56,
        background: theme.colorBgContainer,
        borderBottom: `1px solid ${theme.colorBorderSecondary}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 0 0 24px',
        flexShrink: 0,
        gap: 16,
        // Make the header draggable as the window title bar
        WebkitAppRegion: 'drag' as const,
      }}
      onDoubleClick={() => {
        // Standard title bar behavior: double-click toggles maximize
        window.api.window.maximize();
      }}
    >
      {/* Logo + title — clickable (no-drag) */}
      <div
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          WebkitAppRegion: 'no-drag' as const,
        }}
        onClick={() => navigate('/')}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <img src={logoSrc} alt="PaperPilot" height={28} style={{ width: 28, height: 28 }} />
        <span
          style={{
            fontFamily: 'Montserrat, OPPO Sans 4.0, OPPO Sans, sans-serif',
            fontWeight: 900,
            fontSize: 18,
            color: theme.colorText,
            letterSpacing: '-0.01em',
          }}
        >
          PaperPilot
        </span>
      </div>

      {/* Vertical divider */}
      <div style={{ width: 1, height: 20, background: theme.colorBorderSecondary, flexShrink: 0 }} />

      {/* Nav text buttons — interactive (no-drag) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          WebkitAppRegion: 'no-drag' as const,
        }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <Button type="text" size="small" onClick={() => navigate('/settings')}>
          设置
        </Button>
        <Button type="text" size="small" onClick={() => navigate('/archive')}>
          归档
        </Button>
        <Button type="text" size="small" onClick={() => navigate('/about')}>
          关于
        </Button>
      </div>

      {/* Spacer — still draggable */}
      <div style={{ flex: 1 }} />

      {/* Window control buttons — right-aligned, no-drag */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '100%',
          WebkitAppRegion: 'no-drag' as const,
        }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <WindowButton
          onClick={handleMinimize}
          variant="default"
          title="最小化"
          isDark={isDark}
          color={buttonColor}
        >
          <Minus size={16} strokeWidth={1.5} />
        </WindowButton>
        <WindowButton
          onClick={handleMaximize}
          variant="default"
          title={isMaximized ? '向下还原' : '最大化'}
          isDark={isDark}
          color={buttonColor}
        >
          {isMaximized ? (
            <Copy size={14} strokeWidth={1.5} />
          ) : (
            <Square size={13} strokeWidth={1.5} />
          )}
        </WindowButton>
        <WindowButton
          onClick={handleClose}
          variant="close"
          title="关闭"
          isDark={isDark}
          color={buttonColor}
        >
          <X size={17} strokeWidth={1.5} />
        </WindowButton>
      </div>
    </div>
  );
}

export const Header = memo(HeaderComp);
