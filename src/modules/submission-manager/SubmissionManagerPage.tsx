import { memo, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Empty, Button } from '@lobehub/ui';
import { Mail, Settings } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from 'antd-style';
import { useProjectStore } from '@renderer/stores/projectStore';
import { pageVariants } from '@renderer/lib/motion';
import { EmailList } from './EmailList';
import { EmailDetail } from './EmailDetail';
import { matchesPaperTitle, useSubmissionStore } from './store';

// Poll interval — fetch new emails every 5 minutes while configured
const EMAIL_POLL_INTERVAL_MS = 5 * 60 * 1000;

function SubmissionManagerPageComp(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const projectId = id ?? '';

  const imapConfigured = useSubmissionStore((s) => s.imapConfigured);
  const configChecked = useSubmissionStore((s) => s.configChecked);
  const loading = useSubmissionStore((s) => s.loading);
  const emails = useSubmissionStore((s) => s.emails);
  const checkImapConfig = useSubmissionStore((s) => s.checkImapConfig);
  const loadEmails = useSubmissionStore((s) => s.loadEmails);
  const fetchEmails = useSubmissionStore((s) => s.fetchEmails);
  const setPaperTitle = useSubmissionStore((s) => s.setPaperTitle);
  const projectTitle = useProjectStore((s) => s.currentProject?.title ?? '');

  // Check if any emails match the paper title — gates auto-polling
  const hasPaperEmails = useMemo(
    () => emails.some((e) => matchesPaperTitle(e, projectTitle)),
    [emails, projectTitle],
  );

  // Keep store paper title in sync so auto-select / detail use the same filter as the list
  useEffect(() => {
    setPaperTitle(projectTitle);
  }, [projectTitle, setPaperTitle]);

  // On mount: check IMAP config (F22 — guidance card when null)
  useEffect(() => {
    if (!projectId) return;
    checkImapConfig();
  }, [projectId, checkImapConfig]);

  // Once configured: load existing emails + initial fetch
  useEffect(() => {
    if (!projectId || !imapConfigured) return;
    loadEmails(projectId);
    fetchEmails(projectId);
  }, [projectId, imapConfigured, loadEmails, fetchEmails]);

  // Polling — only auto-poll when paper-related emails already exist
  useEffect(() => {
    if (!projectId || !imapConfigured || !hasPaperEmails) return;
    const timer = setInterval(() => {
      fetchEmails(projectId);
    }, EMAIL_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [projectId, imapConfigured, hasPaperEmails, fetchEmails]);

  // Fetch on window focus — only when paper-related emails already exist
  useEffect(() => {
    if (!projectId || !imapConfigured || !hasPaperEmails) return;
    const handleVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        fetchEmails(projectId);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [projectId, imapConfigured, hasPaperEmails, fetchEmails]);

  // Loading state — config check in progress
  if (!configChecked) return null;

  // F22 — IMAP not configured: show guidance card with "前往设置" button
  if (!imapConfigured) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: theme.colorBgLayout,
        }}
      >
        <div>
          <Empty
            icon={Mail}
            title="邮件功能未配置"
            description="请先在设置页面配置 IMAP 邮箱，配置完成后即可自动接收投稿相关邮件"
            type="page"
            action={
              <Button type="primary" icon={<Settings size={16} />} onClick={() => navigate('/settings')}>
                前往设置
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (!projectId) {
    return (
      <div style={{ padding: 24 }}>
        <Empty title="项目不存在" description="未提供有效的项目 ID" type="page" />
      </div>
    );
  }

  // Configured — split view: list (left) + detail (right)
  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      style={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
        background: theme.colorBgLayout,
        gap: 16,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: 360,
          flexShrink: 0,
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${theme.colorBorderSecondary}`,
          borderRadius: 8,
          background: theme.colorBgContainer,
          overflow: 'hidden',
        }}
      >
        <EmailList projectId={projectId} projectTitle={projectTitle} />
      </div>
      <div
        style={{
          flex: 1,
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${theme.colorBorderSecondary}`,
          borderRadius: 8,
          background: theme.colorBgContainer,
          overflow: 'hidden',
        }}
      >
        <EmailDetail loading={loading} />
      </div>
    </motion.div>
  );
}

export const SubmissionManagerPage = memo(SubmissionManagerPageComp);
