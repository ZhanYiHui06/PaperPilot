import { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button, Empty } from '@lobehub/ui';
import { RefreshCw } from 'lucide-react';
import { useTheme } from 'antd-style';
import { EmailCard } from './EmailCard';
import { EmailFilter } from './EmailFilter';
import { matchesPaperTitle, useSubmissionStore } from './store';
import type { EmailFilterType } from './store';

interface EmailListProps {
  projectId: string;
  projectTitle: string;
}

const SKELETON_COUNT = 4;
const FILTER_LOADING_MS = 280;

/** Brief skeleton placeholders shown while switching email tags. */
function FilterSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0.3 }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.08 }}
          style={{
            borderRadius: 12,
            padding: '12px 14px',
            border: `1px solid ${theme.colorBorderSecondary}`,
            background: theme.colorFillQuaternary,
          }}
        >
          <div
            style={{
              height: 14,
              width: '70%',
              borderRadius: 4,
              background: theme.colorBorderSecondary,
            }}
          />
          <div
            style={{
 marginTop: 8,
              height: 12,
              width: '40%',
              borderRadius: 4,
              background: theme.colorBorderSecondary,
            }}
          />
        </motion.div>
      ))}
    </div>
  );
}

function EmailListComp({ projectId, projectTitle }: EmailListProps): React.ReactElement {
  const theme = useTheme();
  const emails = useSubmissionStore((s) => s.emails);
  const selectedId = useSubmissionStore((s) => s.selectedId);
  const filterType = useSubmissionStore((s) => s.filterType);
  const loading = useSubmissionStore((s) => s.loading);
  const fetching = useSubmissionStore((s) => s.fetching);
  const selectEmail = useSubmissionStore((s) => s.selectEmail);
  const filterEmails = useSubmissionStore((s) => s.filterEmails);
  const fetchEmails = useSubmissionStore((s) => s.fetchEmails);

  // Non-linear loading: when filterType changes, show a brief skeleton phase
  // before revealing the filtered list with staggered entrance animation.
  const [filterLoading, setFilterLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<EmailFilterType>(filterType);

  useEffect(() => {
    if (filterType === activeFilter) return;
    setFilterLoading(true);
    const timer = setTimeout(() => {
      setFilterLoading(false);
      setActiveFilter(filterType);
    }, FILTER_LOADING_MS);
    return () => clearTimeout(timer);
  }, [filterType, activeFilter]);

  const filteredEmails = useMemo(() => {
    let result = emails.filter((e) => matchesPaperTitle(e, projectTitle));
    // Email type filter — revision emails are merged into decision
    if (activeFilter !== 'all') {
      if (activeFilter === 'decision') {
        result = result.filter((e) => e.email_type === 'decision' || e.email_type === 'revision');
      } else {
        result = result.filter((e) => e.email_type === activeFilter);
      }
    }
    return result;
  }, [emails, activeFilter, projectTitle]);

  // Keep detail pane in sync: clear/reselect when current selection is filtered out
  useEffect(() => {
    if (!selectedId) return;
    if (filteredEmails.some((e) => e.id === selectedId)) return;
    selectEmail(filteredEmails[0]?.id ?? null);
  }, [filteredEmails, selectedId, selectEmail]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Top bar: filter + fetch button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colorBorderSecondary}`,
          flexShrink: 0,
        }}
      >
        <EmailFilter value={filterType} onChange={filterEmails} />
        <Button
          type="primary"
          icon={<RefreshCw size={16} />}
          loading={fetching}
          onClick={() => fetchEmails(projectId)}
        >
          拉取邮件
        </Button>
      </div>

      {/* List body — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: filteredEmails.length === 0 && !loading && !filterLoading ? 'center' : 'flex-start' }}>
        {loading ? null : filterLoading ? (
          <FilterSkeleton theme={theme} />
        ) : filteredEmails.length === 0 ? (
          <Empty
            title={activeFilter === 'all' ? '暂无与本文相关邮件' : '无匹配邮件'}
            description={
              activeFilter === 'all'
                ? '点击右上角"拉取邮件"获取最新邮件'
                : '尝试切换筛选条件'
            }
          />
        ) : (
          // key={activeFilter} forces re-mount on tag switch → staggered entrance
          <AnimatePresence key={activeFilter} mode="popLayout">
            {filteredEmails.map((email, index) => (
              <EmailCard
                key={email.id}
                email={email}
                index={index}
                selected={email.id === selectedId}
                onSelect={selectEmail}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

export const EmailList = memo(EmailListComp);
