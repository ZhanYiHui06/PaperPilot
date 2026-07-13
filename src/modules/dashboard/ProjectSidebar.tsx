import { memo, useRef, useState, useLayoutEffect } from 'react';
import { motion } from 'motion/react';
import { DraggableSideNav } from '@lobehub/ui';
import { House, Code, FlaskConical, FileText, Send, Download } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from 'antd-style';

// ─── Navigation Items ────────────────────────────────────────────────

interface NavItem {
  key: string;
  label: string;
  icon: typeof House;
  tab: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'overview', label: '概览', icon: House, tab: 'overview' },
  { key: 'code', label: '代码', icon: Code, tab: 'code' },
  { key: 'experiments', label: '实验', icon: FlaskConical, tab: 'experiments' },
  { key: 'writing', label: '写作', icon: FileText, tab: 'writing' },
  { key: 'submission', label: '投稿', icon: Send, tab: 'submission' },
  { key: 'export', label: '导出', icon: Download, tab: 'export' },
];

// ─── Layout Constants ────────────────────────────────────────────────

const ITEM_HEIGHT = 36;
const ICON_CELL_WIDTH = 48; // matches collapsed width (64) minus list padding (8×2)
const ICON_SIZE = 18;
const INDICATOR_TRANSITION = { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const };

// ─── Component ───────────────────────────────────────────────────────

interface ProjectSidebarProps {
  projectId: string;
}

function ProjectSidebarComp({ projectId }: ProjectSidebarProps): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useTheme();
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [offset, setOffset] = useState(0);
  const [expand, setExpand] = useState(true);

  const activeTab = location.pathname.split('/').filter(Boolean)[2] ?? 'overview';
  const activeIndex = NAV_ITEMS.findIndex((item) => item.tab === activeTab);

  // Read active item DOM offset for the sliding indicator (after layout)
  useLayoutEffect(() => {
    const el = itemRefs.current[activeIndex];
    if (el) setOffset(el.offsetTop);
  }, [activeIndex, expand]);

  return (
    <DraggableSideNav
      placement="left"
      defaultWidth={200}
      minWidth={64}
      maxWidth={360}
      showHandle
      showHandleWhenCollapsed={false}
      showBorder
      backgroundColor={token.colorBgContainer}
      onExpandChange={setExpand}
      body={(isExpanded) => (
        <div style={styles.list}>
          {/* Sliding active background indicator */}
          <motion.div
            animate={{ y: offset }}
            transition={INDICATOR_TRANSITION}
            style={styles.indicator(token.colorFillTertiary)}
          />

          {NAV_ITEMS.map((item, index) => {
            const isActive = activeTab === item.tab;
            const Icon = item.icon;

            return (
              <div
                key={item.key}
                ref={(el) => { itemRefs.current[index] = el; }}
                onClick={() => navigate(`/project/${projectId}/${item.tab}`)}
                className={`sidebar-nav-item${isActive ? ' active' : ''}`}
                style={styles.item(isActive ? token.colorText : token.colorTextSecondary)}
                title={!isExpanded ? item.label : undefined}
              >
                <div style={styles.iconCell}>
                  <Icon size={ICON_SIZE} />
                </div>
                {isExpanded && (
                  <span style={styles.label}>
                    {item.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    />
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = {
  list: {
    padding: '12px 8px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    flex: 1,
    position: 'relative' as const,
  },

  indicator: (bg: string) => ({
    position: 'absolute' as const,
    // Anchor at list top; motion `y` then applies translateY(offsetTop)
    top: 0,
    left: 8,
    right: 8,
    height: ITEM_HEIGHT,
    borderRadius: 8,
    background: bg,
    zIndex: 0,
  }),

  item: (color: string) => ({
    display: 'flex',
    alignItems: 'center',
    height: ITEM_HEIGHT,
    borderRadius: 8,
    cursor: 'pointer',
    overflow: 'hidden',
    position: 'relative' as const,
    zIndex: 1,
    color,
  }),

  iconCell: {
    width: ICON_CELL_WIDTH,
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },

  label: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 14,
  },
};

export const ProjectSidebar = memo(ProjectSidebarComp);
