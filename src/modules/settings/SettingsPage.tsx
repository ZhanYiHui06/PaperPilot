import { memo } from 'react';
import { motion } from 'motion/react';
import { Button } from '@lobehub/ui';
import { ArrowLeft, Settings } from 'lucide-react';
import { useTheme } from 'antd-style';
import { useNavigate } from 'react-router-dom';
import { headerVariants } from '@renderer/lib/motion';
import { LLMConfigSection } from './LLMConfigSection';
import { EmailConfigSection } from './EmailConfigSection';
import { GitConfigSection } from './GitConfigSection';
import { LatexEngineSection } from './LatexEngineSection';
import { LatexStorageSection } from './LatexStorageSection';
import { AppearanceSection } from './AppearanceSection';

const GITHUB_URL = 'https://github.com/ZhanYiHui06/PaperPilot';

const GithubIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
    />
  </svg>
);

function SettingsPageComp(): React.ReactElement {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: theme.colorBgLayout,
        overflow: 'hidden',
      }}
    >
      {/* Header bar — float down */}
      <motion.div
        variants={headerVariants}
        initial="hidden"
        animate="visible"
        style={{
          flexShrink: 0,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 24px',
          borderBottom: `1px solid ${theme.colorBorderSecondary}`,
          background: theme.colorBgContainer,
        }}
      >
        <Button
          size="small"
          icon={<ArrowLeft size={16} />}
          onClick={() => navigate('/')}
        >
          返回首页
        </Button>
        <div style={{ width: 1, height: 20, background: theme.colorBorderSecondary, flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={18} style={{ color: theme.colorText }} />
          <span
            style={{
              fontFamily: 'Montserrat, OPPO Sans 4.0, OPPO Sans, sans-serif',
              fontSize: 15,
              fontWeight: 700,
              color: theme.colorText,
              letterSpacing: '-0.01em',
              lineHeight: 1,
              display: 'inline-block',
              transform: 'translateY(-1px)',
            }}
          >
            设置
          </span>
        </div>
      </motion.div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px 32px',
        }}
      >
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <LLMConfigSection />
          <EmailConfigSection />
          <GitConfigSection />
          <LatexEngineSection />
          <LatexStorageSection />
          <AppearanceSection />

          {/* Version footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '32px 0 8px',
              color: theme.colorTextTertiary,
              fontSize: 13,
              fontFamily: 'Montserrat, sans-serif',
            }}
          >
            <span>PaperPilot Alpha 1.0</span>
            <span style={{ opacity: 0.3 }}>·</span>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                color: theme.colorTextTertiary,
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = theme.colorTextSecondary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = theme.colorTextTertiary)}
            >
              <GithubIcon size={15} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export const SettingsPage = memo(SettingsPageComp);
