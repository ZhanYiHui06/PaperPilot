import { memo } from 'react';
import { motion } from 'motion/react';
import { Button } from '@lobehub/ui';
import { ArrowLeft, Info } from 'lucide-react';
import { useTheme } from 'antd-style';
import { useNavigate } from 'react-router-dom';
import { headerVariants, pageVariants } from '@renderer/lib/motion';
import heroImage from '../../assets/about_hero.jpg';

function WeChatIcon({ size = 16, color }: { size?: number; color?: string }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color ?? 'currentColor'}
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.023-.406-.023zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z" />
    </svg>
  );
}

function MailIcon({ size = 16, color }: { size?: number; color?: string }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color ?? 'currentColor'}
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  );
}

function AboutPageComp(): React.ReactElement {
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
          <Info size={18} style={{ color: theme.colorText }} />
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
            关于
          </span>
        </div>
      </motion.div>

      {/* Scrollable content */}
      <motion.div
        variants={pageVariants}
        initial="hidden"
        animate="visible"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 24px 48px',
        }}
      >
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          {/* Hero image — rounded corners on all four sides */}
          <img
            src={heroImage}
            alt="PaperPilot"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              borderRadius: 16,
              boxShadow: theme.boxShadowSecondary,
            }}
          />

          {/* Title */}
          <h1
            style={{
              fontFamily: 'Montserrat, OPPO Sans 4.0, OPPO Sans, sans-serif',
              fontSize: 32,
              fontWeight: 900,
              color: theme.colorText,
              margin: '32px 0 0',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            PaperPilot
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 15,
              color: theme.colorTextSecondary,
              margin: '8px 0 0',
              lineHeight: 1.6,
            }}
          >
            学术论文全生命周期管理工具
          </p>

          {/* Divider */}
          <div
            style={{
              height: 1,
              background: theme.colorBorderSecondary,
              margin: '24px 0',
            }}
          />

          {/* Origin story */}
          <section>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: theme.colorText,
                margin: '0 0 12px',
                fontFamily: 'Montserrat, OPPO Sans 4.0, OPPO Sans, sans-serif',
              }}
            >
              起源
            </h2>
            <p
              style={{
                fontSize: 14,
                color: theme.colorTextSecondary,
                lineHeight: 1.8,
                margin: 0,
              }}
            >
              PaperPilot 诞生于一个朴素的感受：写一篇论文，本不该这么累。
              选题记录散落在便签里，代码版本靠文件夹命名区分，实验数据塞在表格中，LaTeX
              源文件在多个编辑器间来回粘贴，投稿后邮件淹没在收件箱——每一步都不难，却每一步都在消耗专注力。
              工具没有错，只是它们彼此隔离，让人成了工具之间的搬运工。
            </p>
          </section>

          {/* Intent */}
          <section style={{ marginTop: 24 }}>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: theme.colorText,
                margin: '0 0 12px',
                fontFamily: 'Montserrat, OPPO Sans 4.0, OPPO Sans, sans-serif',
              }}
            >
              初衷
            </h2>
            <p
              style={{
                fontSize: 14,
                color: theme.colorTextSecondary,
                lineHeight: 1.8,
                margin: '0 0 12px',
              }}
            >
              PaperPilot 试图把论文的完整生命周期收拢到同一个桌面：选题、代码版本、实验记录、LaTeX
              撰写、投稿追踪、数据导出，各环节既独立成章又彼此关联。
              它不替代你的思考，只是让过程更顺滑——让研究者把时间还给真正重要的事。
            </p>
            <p
              style={{
                fontSize: 14,
                color: theme.colorTextSecondary,
                lineHeight: 1.8,
                margin: 0,
              }}
            >
              愿落笔之时，心无旁骛。
            </p>
          </section>

          {/* Contact */}
          <section style={{ marginTop: 24 }}>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: theme.colorText,
                margin: '0 0 12px',
                fontFamily: 'Montserrat, OPPO Sans 4.0, OPPO Sans, sans-serif',
              }}
            >
              联系方式
            </h2>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 14,
                  color: theme.colorTextSecondary,
                  lineHeight: 1.8,
                }}
              >
                <WeChatIcon size={16} color={theme.colorTextTertiary} />
                <span>Ruofuu</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 14,
                  color: theme.colorTextSecondary,
                  lineHeight: 1.8,
                }}
              >
                <MailIcon size={16} color={theme.colorTextTertiary} />
                <span>zhanyihui06@gmail.com</span>
              </div>
            </div>
          </section>
        </div>
      </motion.div>
    </div>
  );
}

export const AboutPage = memo(AboutPageComp);
