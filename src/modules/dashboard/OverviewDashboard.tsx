import { memo, useEffect, useMemo, useState } from 'react';
import {
  FlaskConical,
  Code,
  FileText,
  Mail,
  CircleDot,
} from 'lucide-react';
import { useTheme } from 'antd-style';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type {
  Experiment,
  CodeVersion,
  LatexVersion,
  Email,
} from '@shared/types';

// ─── Types ──────────────────────────────────────────────────────────

interface DashboardData {
  experiments: Experiment[];
  codeVersions: CodeVersion[];
  latexVersions: LatexVersion[];
  emails: Email[];
}

interface OverviewDashboardProps {
  projectId: string;
}

// ─── Constants ──────────────────────────────────────────────────────

const EXPERIMENT_TYPE_META: Record<
  Experiment['experiment_type'],
  { label: string; color: string }
> = {
  comparison: { label: '对比实验', color: '#3b82f6' },
  ablation: { label: '消融实验', color: '#8b5cf6' },
  sensitivity: { label: '敏感性分析', color: '#f59e0b' },
  other: { label: '其他', color: '#6b7280' },
};

const EMAIL_TYPE_META: Record<string, { label: string; color: string }> = {
  review: { label: '审稿', color: '#3b82f6' },
  decision: { label: '决定', color: '#22c55e' },
  revision: { label: '修改', color: '#f59e0b' },
  other: { label: '其他', color: '#6b7280' },
};

// ─── Hooks ──────────────────────────────────────────────────────────

function useDashboardData(projectId: string): {
  data: DashboardData | null;
  loading: boolean;
} {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      window.api.db.experiments.list(projectId),
      window.api.db.codeVersions.list(projectId),
      window.api.db.latexVersions.list(projectId),
      window.api.db.emails.list(projectId),
    ])
      .then(([experiments, codeVersions, latexVersions, emails]) => {
        if (!cancelled) {
          setData({ experiments, codeVersions, latexVersions, emails });
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { data, loading };
}

// ─── Stat Card ──────────────────────────────────────────────────────

interface StatCardProps {
  icon: typeof FlaskConical;
  label: string;
  value: number;
  sublabel?: string;
  accent: string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  accent,
}: StatCardProps): React.ReactElement {
  const token = useTheme();
  return (
    <div
      style={{
        flex: '1 1 200px',
        minWidth: 200,
        padding: 20,
        background: token.colorBgContainer,
        borderRadius: 12,
        border: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: token.colorTextSecondary }}>{label}</span>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: `${accent}14`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={16} color={accent} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: token.colorText, lineHeight: 1 }}>
          {value}
        </span>
        {sublabel && (
          <span style={{ fontSize: 12, color: token.colorTextTertiary }}>{sublabel}</span>
        )}
      </div>
    </div>
  );
}

// ─── Donut Chart ────────────────────────────────────────────────────

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  total: number;
  centerLabel: string;
  centerValue: number;
}

function DonutChart({
  segments,
  total,
  centerLabel,
  centerValue,
}: DonutChartProps): React.ReactElement {
  const token = useTheme();
  const radius = 56;
  const stroke = 16;
  const circumference = 2 * Math.PI * radius;
  const normalizedSegments = segments.filter((s) => s.value > 0);
  let offset = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
        <svg width={140} height={140} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={70}
            cy={70}
            r={radius}
            fill="none"
            stroke={token.colorFillSecondary}
            strokeWidth={stroke}
          />
          {normalizedSegments.map((seg) => {
            const fraction = seg.value / total;
            const len = fraction * circumference;
            const dasharray = `${len} ${circumference - len}`;
            const circle = (
              <circle
                key={seg.label}
                cx={70}
                cy={70}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeDasharray={dasharray}
                strokeDashoffset={-offset}
                style={{ transition: 'stroke-dashoffset 0.3s ease' }}
              />
            );
            offset += len;
            return circle;
          })}
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 24, fontWeight: 700, color: token.colorText }}>
            {centerValue}
          </span>
          <span style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 2 }}>
            {centerLabel}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>
        {normalizedSegments.map((seg) => (
          <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: seg.color,
                flexShrink: 0,
              }}
            />
            <span
              style={{ fontSize: 12, color: token.colorTextSecondary, flex: 1, minWidth: 0 }}
            >
              {seg.label}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: token.colorText }}>
              {seg.value}
            </span>
            <span style={{ fontSize: 11, color: token.colorTextTertiary, width: 36, textAlign: 'right' }}>
              {Math.round((seg.value / total) * 100)}%
            </span>
          </div>
        ))}
        {normalizedSegments.length === 0 && (
          <span style={{ fontSize: 12, color: token.colorTextTertiary }}>暂无数据</span>
        )}
      </div>
    </div>
  );
}

// ─── Activity Timeline ───────────────────────────────────────────────

interface ActivityItem {
  id: string;
  type: 'experiment' | 'code' | 'latex' | 'email';
  title: string;
  timestamp: string;
}

function buildActivityItems(data: DashboardData): ActivityItem[] {
  const items: ActivityItem[] = [];
  data.experiments.forEach((e) =>
    items.push({
      id: e.id,
      type: 'experiment',
      title: e.name,
      timestamp: e.created_at,
    }),
  );
  data.codeVersions.forEach((c) =>
    items.push({
      id: c.id,
      type: 'code',
      title: c.version_label,
      timestamp: c.timestamp,
    }),
  );
  data.latexVersions.forEach((l) =>
    items.push({
      id: l.id,
      type: 'latex',
      title: l.version_label,
      timestamp: l.timestamp,
    }),
  );
  data.emails.forEach((m) =>
    items.push({
      id: m.id,
      type: 'email',
      title: m.subject,
      timestamp: m.received_at,
    }),
  );
  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

const ACTIVITY_META: Record<
  ActivityItem['type'],
  { icon: typeof FlaskConical; color: string; label: string }
> = {
  experiment: { icon: FlaskConical, color: '#8b5cf6', label: '实验' },
  code: { icon: Code, color: '#3b82f6', label: '代码' },
  latex: { icon: FileText, color: '#22c55e', label: '写作' },
  email: { icon: Mail, color: '#f59e0b', label: '邮件' },
};

function ActivityTimeline({ items }: { items: ActivityItem[] }): React.ReactElement {
  const token = useTheme();
  const top = items.slice(0, 6);

  if (top.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: token.colorTextTertiary,
          fontSize: 13,
        }}
      >
        暂无活动记录
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {top.map((item, i) => {
        const meta = ACTIVITY_META[item.type];
        const Icon = meta.icon;
        return (
          <div
            key={item.id}
            style={{
              display: 'flex',
              gap: 12,
              paddingBottom: i < top.length - 1 ? 18 : 0,
              position: 'relative',
            }}
          >
            {/* Connector extends through padding so gap under the line stays tight */}
            {i < top.length - 1 && (
              <div
                style={{
                  position: 'absolute',
                  left: 13.5,
                  top: 28,
                  bottom: 0,
                  width: 1,
                  background: token.colorBorderSecondary,
                  pointerEvents: 'none',
                }}
              />
            )}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: `${meta.color}14`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <Icon size={13} color={meta.color} />
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingBottom: 2 }}>
              <div
                style={{
                  fontSize: 13,
                  color: token.colorText,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 500,
                }}
              >
                {item.title}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                <span
                  style={{
                    fontSize: 11,
                    color: meta.color,
                    fontWeight: 500,
                  }}
                >
                  {meta.label}
                </span>
                <span style={{ fontSize: 11, color: token.colorTextTertiary }}>
                  {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: zhCN })}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Card Wrapper ────────────────────────────────────────────────────

interface CardProps {
  title: string;
  icon?: typeof FlaskConical;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

function Card({ title, icon: Icon, children, style }: CardProps): React.ReactElement {
  const token = useTheme();
  return (
    <div
      style={{
        background: token.colorBgContainer,
        borderRadius: 12,
        border: `1px solid ${token.colorBorderSecondary}`,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
        }}
      >
        {Icon && <Icon size={15} color={token.colorTextSecondary} />}
        <span style={{ fontSize: 14, fontWeight: 600, color: token.colorText }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

function OverviewDashboardComp({ projectId }: OverviewDashboardProps): React.ReactElement {
  const token = useTheme();
  const { data, loading } = useDashboardData(projectId);

  const activityItems = useMemo(() => (data ? buildActivityItems(data) : []), [data]);

  const experimentSegments = useMemo<DonutSegment[]>(() => {
    if (!data) return [];
    const counts: Record<string, number> = {};
    data.experiments.forEach((e) => {
      counts[e.experiment_type] = (counts[e.experiment_type] ?? 0) + 1;
    });
    return (['comparison', 'ablation', 'sensitivity', 'other'] as const)
      .map((t) => ({
        label: EXPERIMENT_TYPE_META[t].label,
        value: counts[t] ?? 0,
        color: EXPERIMENT_TYPE_META[t].color,
      }))
      .filter((s) => s.value > 0);
  }, [data]);

  const emailSegments = useMemo<DonutSegment[]>(() => {
    if (!data) return [];
    const counts: Record<string, number> = {};
    data.emails.forEach((m) => {
      const key = m.email_type ?? 'other';
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return (['review', 'decision', 'revision', 'other'] as const)
      .map((t) => ({
        label: EMAIL_TYPE_META[t].label,
        value: counts[t] ?? 0,
        color: EMAIL_TYPE_META[t].color,
      }))
      .filter((s) => s.value > 0);
  }, [data]);

  if (loading || !data) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: token.colorTextTertiary,
          fontSize: 13,
        }}
      >
        加载中…
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* ─── Stat Cards ─── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <StatCard
          icon={FlaskConical}
          label="实验总数"
          value={data.experiments.length}
          sublabel="进行中"
          accent="#8b5cf6"
        />
        <StatCard
          icon={Code}
          label="代码版本"
          value={data.codeVersions.length}
          sublabel="版本记录"
          accent="#3b82f6"
        />
        <StatCard
          icon={FileText}
          label="写作版本"
          value={data.latexVersions.length}
          sublabel="草稿记录"
          accent="#22c55e"
        />
        <StatCard
          icon={Mail}
          label="邮件"
          value={data.emails.filter((m) => !m.is_read).length}
          sublabel="未读"
          accent="#f59e0b"
        />
      </div>

      {/* ─── Charts Row ─── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Card
          title="实验类型分布"
          icon={FlaskConical}
          style={{ flex: '1 1 320px', minWidth: 320 }}
        >
          <DonutChart
            segments={experimentSegments}
            total={data.experiments.length}
            centerLabel="实验总数"
            centerValue={data.experiments.length}
          />
        </Card>
        <Card
          title="邮件分类"
          icon={Mail}
          style={{ flex: '1 1 320px', minWidth: 320 }}
        >
          <DonutChart
            segments={emailSegments}
            total={data.emails.length}
            centerLabel="邮件总数"
            centerValue={data.emails.length}
          />
        </Card>
      </div>

      {/* ─── Activity Row ─── */}
      <Card
        title="最近活动"
        icon={CircleDot}
        style={{ flex: '1 1 100%', minWidth: 320 }}
      >
        <ActivityTimeline items={activityItems} />
      </Card>
    </div>
  );
}

export const OverviewDashboard = memo(OverviewDashboardComp);
