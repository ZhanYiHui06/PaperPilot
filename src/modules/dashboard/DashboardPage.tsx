import { memo, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Empty } from '@lobehub/ui';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams, Outlet, useLocation } from 'react-router-dom';
import { useTheme } from 'antd-style';
import { useProjectStore } from '@renderer/stores/projectStore';
import {
  DASHBOARD_MAIN_ENTER_DELAY_MS,
  headerVariants,
  pageVariants,
  sidebarVariants,
} from '@renderer/lib/motion';
import { ProjectSidebar } from './ProjectSidebar';
import { ProgressGraph } from './ProgressGraph';
import { OverviewDashboard } from './OverviewDashboard';

function DashboardPageComp(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const token = useTheme();
  const getProject = useProjectStore((s) => s.getProject);
  const currentProject = useProjectStore((s) => s.currentProject);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  /** Defer heavy main pane mount so header/sidebar entrance stays smooth. */
  const [mainReady, setMainReady] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    getProject(id)
      .then((project) => {
        setLoading(false);
        if (!project) setNotFound(true);
      })
      .catch(() => {
        setLoading(false);
        setNotFound(true);
      });
  }, [id, getProject]);

  // Chrome first (header + sidebar), then mount main content.
  useEffect(() => {
    setMainReady(false);
    const timer = window.setTimeout(() => setMainReady(true), DASHBOARD_MAIN_ENTER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [id]);

  if (notFound || (!loading && !currentProject) || !id) {
    return (
      <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
        <Empty title="项目不存在" description="该项目可能已被删除或归档" type="page" />
      </div>
    );
  }

  const segments = location.pathname.split('/').filter(Boolean);
  const activeTab = segments.length > 2 ? segments[2] : 'overview';
  const isOverview = activeTab === 'overview';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top bar — first wave */}
      <motion.div
        variants={headerVariants}
        initial="hidden"
        animate="visible"
        style={{
          height: 40,
          flexShrink: 0,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 24px',
          fontSize: 13,
          color: token.colorTextSecondary,
          background: token.colorBgContainer,
          willChange: 'transform, opacity',
        }}
      >
        <div
          onClick={() => navigate('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            color: token.colorTextSecondary,
            padding: '4px 8px',
            borderRadius: 6,
            marginLeft: -8,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = token.colorFillTertiary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <ArrowLeft size={14} />
          <span style={{ fontSize: 13, whiteSpace: 'nowrap' }}>返回首页</span>
        </div>
        <span style={{ color: token.colorBorderSecondary }}>/</span>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: token.colorText,
            fontWeight: 500,
            flex: 1,
          }}
        >
          {currentProject?.title}
        </span>
      </motion.div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar — first wave, slide from left */}
        <motion.div
          variants={sidebarVariants}
          initial="hidden"
          animate="visible"
          style={{ display: 'flex', height: '100%', willChange: 'transform, opacity' }}
        >
          <ProjectSidebar projectId={id} />
        </motion.div>

        {/* Main content — second wave (mount + animate after chrome) */}
        {mainReady ? (
          <motion.div
            variants={pageVariants}
            initial="hidden"
            animate="visible"
            style={{
              flex: 1,
              overflow: isOverview ? 'auto' : 'hidden',
              padding: 24,
              background: token.colorBgLayout,
              display: 'flex',
              flexDirection: 'column',
              willChange: 'transform, opacity',
            }}
          >
            {isOverview && (
              <ProgressGraph projectId={id} targetVenue={currentProject?.target_venue ?? null} />
            )}
            <div
              style={{
                marginTop: isOverview ? 16 : 0,
                flex: 1,
                minHeight: isOverview ? 'auto' : 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {isOverview && currentProject && <OverviewDashboard projectId={id} />}
              <Outlet />
            </div>
          </motion.div>
        ) : (
          <div
            style={{
              flex: 1,
              background: token.colorBgLayout,
            }}
          />
        )}
      </div>
    </div>
  );
}

export const DashboardPage = memo(DashboardPageComp);
