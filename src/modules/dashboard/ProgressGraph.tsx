import '@xyflow/react/dist/style.css';
import { memo, useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { Tooltip, Empty, toast, Button } from '@lobehub/ui';
import { Modal, Input, Select } from 'antd';
import {
  ChevronRight,
  GitBranch,
  ChevronLeft,
  Check,
  Target as TargetIcon,
  Maximize2,
} from 'lucide-react';
import { useTheme } from 'antd-style';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MarkerType,
  Handle,
  Position,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';

import {
  phaseConfig,
  nextPhaseOptions,
  TERMINAL_PHASES,
  BRANCHABLE_PHASES,
  CORE_PHASE_ORDER,
} from '@renderer/lib/phaseConfig';
import { useProjectStore } from '@renderer/stores/projectStore';
import type { ProgressNode, ProjectPhase, ProgressNodeStatus } from '@shared/types';

interface ProgressGraphProps {
  projectId: string;
  targetVenue: string | null;
}

// ─── Layout constants ───
const NODE_WIDTH = 85;
const NODE_UNIT_X = 121;  // horizontal center-to-center distance between adjacent nodes
const NODE_UNIT_Y = 110;  // vertical distance between branch levels
const MAIN_PATH_Y = 20;

// Phases allowed as a branch starting point (resubmission to another venue)
const BRANCH_START_PHASES: ProjectPhase[] = ['pending_submit', 'writing', 'experiment', 'coding'];

// ─── React Flow node data shape ───
interface PhaseNodeData extends Record<string, unknown> {
  phase: ProjectPhase;
  belowLabel: string;
  tooltipTitle: string;
  updatedLabel: string;
  status: ProgressNodeStatus;
  hasBranch: boolean; // whether this node is a branch parent (shows bottom handle)
}

type PhaseRFNode = Node<PhaseNodeData, 'phaseNode'>;

// ─── Custom node: React Flow default look + default handle style ───
// Left/Right handles always present; Bottom source handle only when hasBranch.
const PhaseNodeComponent = ({ data }: NodeProps<PhaseRFNode>): React.ReactElement => {
  const token = useTheme();
  const d = data;
  const meta = phaseConfig[d.phase];
  const isInProgress = d.status === 'in_progress';
  const isDone = d.status === 'done';
  const isSkipped = d.status === 'skipped';

  const borderColor = isInProgress
    ? meta.bg
    : isDone
      ? token.colorText
      : token.colorBorderSecondary;

  return (
    <Tooltip
      title={
        <div style={{ fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.tooltipTitle}</div>
          <div style={{ opacity: 0.7 }}>更新于 {d.updatedLabel}</div>
        </div>
      }
      placement="top"
    >
      <motion.div
        animate={{
          boxShadow: isInProgress
            ? [
                `0 0 4px ${meta.bg}40`,
                `0 0 12px ${meta.bg}99`,
                `0 0 4px ${meta.bg}40`,
              ]
            : 'none',
        }}
        transition={
          isInProgress
            ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0 }
        }
        style={{
          background: token.colorBgContainer,
          border: `${isInProgress ? 2 : 1}px solid ${borderColor}`,
          borderRadius: 8,
          padding: '6px 12px',
          fontSize: 12.5,
          color: token.colorText,
          width: NODE_WIDTH,
          opacity: isSkipped ? 0.5 : 1,
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        <Handle type="target" position={Position.Left} id="left" />
        <div style={{ textAlign: 'center', padding: '2px 0' }}>
          <span style={{ fontWeight: isInProgress ? 600 : 500 }}>{d.belowLabel}</span>
        </div>
        <Handle type="source" position={Position.Right} id="right" />
        {d.hasBranch && <Handle type="source" position={Position.Bottom} id="bottom" />}
      </motion.div>
    </Tooltip>
  );
};

const nodeTypes: NodeTypes = { phaseNode: PhaseNodeComponent };

// ─── Fit-view floating button (top-right of canvas) ───
const FitViewButton = (): React.ReactElement => {
  const { fitView } = useReactFlow();
  return (
    <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}>
      <Tooltip title="适应窗口" placement="left">
        <Button
          size="small"
          icon={<Maximize2 size={14} />}
          onClick={() => fitView({ padding: 0.15, maxZoom: 1, duration: 300 })}
        />
      </Tooltip>
    </div>
  );
};

// ─── Layout computation ───
function computeLayout(nodes: ProgressNode[]): {
  positions: Map<string, { x: number; y: number }>;
  depthMap: Map<string, number>;
  parentIds: Set<string>;
  mainNodes: ProgressNode[];
  branchesByParent: Map<string, ProgressNode[]>;
} {
  const mainNodes = nodes
    .filter((n) => n.parent_branch_id === null)
    .sort((a, b) => a.order_index - b.order_index);

  const branchNodes = nodes.filter((n) => n.parent_branch_id !== null);

  const depthMap = new Map<string, number>();
  mainNodes.forEach((n) => depthMap.set(n.id, 0));

  const branchesByParent = new Map<string, ProgressNode[]>();
  const parentIds = new Set<string>();
  branchNodes.forEach((n) => {
    const pid = n.parent_branch_id!;
    parentIds.add(pid);
    if (!branchesByParent.has(pid)) branchesByParent.set(pid, []);
    branchesByParent.get(pid)!.push(n);
  });
  branchesByParent.forEach((arr) => arr.sort((a, b) => a.order_index - b.order_index));

  let changed = true;
  while (changed && branchNodes.length > 0) {
    changed = false;
    for (const bn of branchNodes) {
      if (depthMap.has(bn.id)) continue;
      const parentDepth = bn.parent_branch_id ? depthMap.get(bn.parent_branch_id) : undefined;
      if (parentDepth !== undefined) {
        depthMap.set(bn.id, parentDepth + 1);
        changed = true;
      }
    }
  }
  branchNodes.forEach((bn) => {
    if (!depthMap.has(bn.id)) depthMap.set(bn.id, 1);
  });

  const positions = new Map<string, { x: number; y: number }>();
  mainNodes.forEach((n, i) => {
    positions.set(n.id, { x: i * NODE_UNIT_X, y: MAIN_PATH_Y });
  });

  // Branch nodes offset to the right of parent so bottom→left bezier curves naturally
  const sortedBranchNodes = branchNodes
    .slice()
    .sort((a, b) => (depthMap.get(a.id) ?? 0) - (depthMap.get(b.id) ?? 0));
  for (const bn of sortedBranchNodes) {
    const parentPos = bn.parent_branch_id ? positions.get(bn.parent_branch_id) : undefined;
    const depth = depthMap.get(bn.id) ?? 1;
    positions.set(bn.id, {
      x: parentPos
        ? parentPos.x + (bn.order_index + 1) * NODE_UNIT_X
        : (bn.order_index + 1) * NODE_UNIT_X,
      y: MAIN_PATH_Y + depth * NODE_UNIT_Y,
    });
  }

  return { positions, depthMap, parentIds, mainNodes, branchesByParent };
}

function ProgressGraphComp({ projectId, targetVenue }: ProgressGraphProps): React.ReactElement {
  const token = useTheme();
  const [nodes, setNodes] = useState<ProgressNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [choiceModalOpen, setChoiceModalOpen] = useState(false);
  const [choiceOptions, setChoiceOptions] = useState<ProjectPhase[]>([]);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [branchLabel, setBranchLabel] = useState('');
  const [branchStartPhase, setBranchStartPhase] = useState<ProjectPhase>('pending_submit');
  const updateProject = useProjectStore((s) => s.updateProject);

  const fetchNodes = useCallback(async () => {
    try {
      const result = await window.api.db.progressNodes.list(projectId);
      setNodes(result);
    } catch {
      toast.error({ title: '加载进度节点失败' });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    fetchNodes();
  }, [fetchNodes]);

  // ─── Derived state ───
  const currentNode = nodes.find((n) => n.status === 'in_progress') ?? null;
  const currentPhase = currentNode?.phase;
  const isTerminal = currentPhase ? TERMINAL_PHASES.has(currentPhase) : false;
  const canBranch = currentPhase ? BRANCHABLE_PHASES.has(currentPhase) : false;

  // ─── Advance logic ───
  const options = currentPhase ? nextPhaseOptions(currentPhase) : [];
  const canAdvance = options.length > 0 && !isTerminal;

  const handleAdvance = (): void => {
    if (!currentNode || isTerminal) return;
    if (options.length === 0) return;
    if (options.length === 1) {
      void advanceTo(options[0]);
    } else {
      setChoiceOptions(options);
      setChoiceModalOpen(true);
    }
  };

  const advanceTo = async (targetPhase: ProjectPhase): Promise<void> => {
    if (!currentNode) return;
    try {
      await window.api.db.progressNodes.update(currentNode.id, { status: 'done' });
      const pathNodes = currentNode.parent_branch_id
        ? nodes.filter((n) => n.parent_branch_id === currentNode.parent_branch_id)
        : nodes.filter((n) => n.parent_branch_id === null);
      const existing = pathNodes.find((n) => n.phase === targetPhase);
      if (existing) {
        await window.api.db.progressNodes.update(existing.id, { status: 'in_progress' });
      } else {
        const nextOrder = pathNodes.length > 0
          ? Math.max(...pathNodes.map((n) => n.order_index)) + 1
          : 0;
        await window.api.db.progressNodes.create({
          project_id: projectId,
          phase: targetPhase,
          label: phaseConfig[targetPhase].label,
          order_index: nextOrder,
          parent_branch_id: currentNode.parent_branch_id ?? null,
          status: 'in_progress',
        });
      }
      await updateProject(projectId, { phase: targetPhase });
      await fetchNodes();
    } catch {
      toast.error({ title: '更新失败' });
    }
  };

  // ─── Branch logic ───
  const handleOpenBranchModal = (): void => {
    setBranchLabel('');
    setBranchStartPhase('pending_submit');
    setBranchModalOpen(true);
  };

  const handleCreateBranch = async (): Promise<void> => {
    if (!currentNode || !branchLabel.trim()) return;
    try {
      await window.api.db.progressNodes.update(currentNode.id, { status: 'done' });
      await window.api.db.progressNodes.create({
        project_id: projectId,
        phase: branchStartPhase,
        label: branchLabel.trim(),
        order_index: 0,
        parent_branch_id: currentNode.id,
        status: 'in_progress',
      });
      await updateProject(projectId, { phase: branchStartPhase });
      await fetchNodes();
      setBranchModalOpen(false);
      toast.success({ title: '转投分支已创建' });
    } catch {
      toast.error({ title: '创建分支失败' });
    }
  };

  // ─── Go back logic ───
  const handleGoBack = async (): Promise<void> => {
    if (!currentNode) return;
    try {
      if (currentNode.parent_branch_id) {
        const parentNode = nodes.find((n) => n.id === currentNode.parent_branch_id);
        await window.api.db.progressNodes.delete(currentNode.id);
        if (parentNode) {
          await window.api.db.progressNodes.update(parentNode.id, { status: 'in_progress' });
          await updateProject(projectId, { phase: parentNode.phase });
        }
      } else {
        const mainNodes = nodes
          .filter((n) => n.parent_branch_id === null)
          .sort((a, b) => a.order_index - b.order_index);
        const currentIndex = mainNodes.findIndex((n) => n.id === currentNode.id);
        if (currentIndex <= 0) return;
        const prevNode = mainNodes[currentIndex - 1];
        const isCore = CORE_PHASE_ORDER.includes(currentNode.phase);
        if (!isCore) {
          await window.api.db.progressNodes.delete(currentNode.id);
        } else {
          await window.api.db.progressNodes.update(currentNode.id, { status: 'pending' });
        }
        await window.api.db.progressNodes.update(prevNode.id, { status: 'in_progress' });
        await updateProject(projectId, { phase: prevNode.phase });
      }
      await fetchNodes();
    } catch {
      toast.error({ title: '更新失败' });
    }
  };

  // ─── End flow logic ───
  const handleEndFlow = async (): Promise<void> => {
    if (!currentNode) return;
    try {
      await window.api.db.progressNodes.update(currentNode.id, { status: 'done' });
      const pathNodes = currentNode.parent_branch_id
        ? nodes.filter((n) => n.parent_branch_id === currentNode.parent_branch_id)
        : nodes.filter((n) => n.parent_branch_id === null);
      const afterCurrent = pathNodes.filter(
        (n) => n.order_index > currentNode.order_index && n.status === 'pending',
      );
      await Promise.all(
        afterCurrent.map((n) =>
          window.api.db.progressNodes.update(n.id, { status: 'skipped' }),
        ),
      );
      await updateProject(projectId, { phase: currentNode.phase });
      await fetchNodes();
      toast.success({ title: '流程已结束' });
    } catch {
      toast.error({ title: '更新失败' });
    }
  };

  const canGoBack = (() => {
    if (!currentNode) return false;
    if (currentNode.parent_branch_id) return true;
    const mainNodes = nodes
      .filter((n) => n.parent_branch_id === null)
      .sort((a, b) => a.order_index - b.order_index);
    const idx = mainNodes.findIndex((n) => n.id === currentNode.id);
    return idx > 0;
  })();

  // ─── Build React Flow nodes & edges ───
  const colorTextTertiary = token.colorTextTertiary;
  const colorBorderSecondary = token.colorBorderSecondary;
  const { rfNodes, rfEdges, maxDepth } = useMemo(() => {
    const { positions, depthMap, parentIds, mainNodes, branchesByParent } = computeLayout(nodes);

    const rfNodes: PhaseRFNode[] = nodes.map((n) => {
      const pos = positions.get(n.id) ?? { x: 0, y: MAIN_PATH_Y };
      const isBranch = n.parent_branch_id !== null;
      const meta = phaseConfig[n.phase];
      const phaseLabel = meta?.label ?? n.label;
      const belowLabel = isBranch ? phaseLabel : n.label;
      const tooltipTitle = isBranch ? `${n.label} · ${phaseLabel}` : n.label;
      const updatedDate = n.updated_at ? new Date(n.updated_at) : null;
      const updatedLabel = updatedDate && !isNaN(updatedDate.getTime())
        ? format(updatedDate, 'yyyy-MM-dd HH:mm', { locale: zhCN })
        : '—';

      return {
        id: n.id,
        type: 'phaseNode',
        position: pos,
        data: {
          phase: n.phase,
          belowLabel,
          tooltipTitle,
          updatedLabel,
          status: n.status,
          hasBranch: parentIds.has(n.id),
        },
        draggable: false,
      };
    });

    const buildEdge = (
      src: ProgressNode,
      tgt: ProgressNode,
      sourceHandle: string,
      targetHandle: string,
    ): Edge => {
      const lineDone = src.status === 'done' && tgt.status !== 'pending';
      const color = lineDone ? colorTextTertiary : colorBorderSecondary;
      return {
        id: `e-${src.id}-${tgt.id}`,
        source: src.id,
        target: tgt.id,
        sourceHandle,
        targetHandle,
        type: 'default',
        animated: !lineDone,
        style: { stroke: color, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
      };
    };

    const rfEdges: Edge[] = [];
    // Main path: right handle → left handle
    for (let i = 0; i < mainNodes.length - 1; i++) {
      rfEdges.push(buildEdge(mainNodes[i], mainNodes[i + 1], 'right', 'left'));
    }
    // Branches: parent bottom handle → branch left handle, then right→left within branch
    branchesByParent.forEach((arr, parentId) => {
      const parent = nodes.find((n) => n.id === parentId);
      if (!parent || arr.length === 0) return;
      rfEdges.push(buildEdge(parent, arr[0], 'bottom', 'left'));
      for (let i = 0; i < arr.length - 1; i++) {
        rfEdges.push(buildEdge(arr[i], arr[i + 1], 'right', 'left'));
      }
    });

    const maxDepth = nodes.length > 0
      ? Math.max(0, ...Array.from(depthMap.values()))
      : 0;

    return { rfNodes, rfEdges, maxDepth };
  }, [nodes, colorTextTertiary, colorBorderSecondary]);

  if (loading) return null;

  if (nodes.length === 0) {
    return <Empty title="暂无进度节点" description="项目初始化后将在此显示进度图" />;
  }

  const canvasHeight = Math.min(360, Math.max(120, 70 + maxDepth * NODE_UNIT_Y));
  const btnSize = 'small';
  const btnStyle: React.CSSProperties = { fontSize: 12 };

  return (
    <ReactFlowProvider>
      <div
        style={{
          padding: 16,
          borderRadius: 12,
          border: `1px solid ${token.colorBorderSecondary}`,
          background: `linear-gradient(135deg, ${token.colorBgContainer} 0%, ${token.colorBgElevated} 100%)`,
        }}
      >
        {/* ─── Toolbar ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          {targetVenue && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: token.colorTextSecondary }}>
              <TargetIcon size={14} style={{ color: token.colorPrimary }} />
              <span>Target:</span>
              <span style={{ fontWeight: 600, color: token.colorText }}>{targetVenue}</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Button size={btnSize} icon={<ChevronLeft size={14} />} onClick={handleGoBack} disabled={!canGoBack} style={btnStyle}>
              上一阶段
            </Button>
            <Button size={btnSize} icon={<ChevronRight size={14} />} onClick={handleAdvance} disabled={!canAdvance} style={btnStyle}>
              下一阶段
            </Button>
            <Button size={btnSize} icon={<GitBranch size={14} />} onClick={handleOpenBranchModal} disabled={!canBranch} style={btnStyle}>
              旁生分支
            </Button>
            <Button size={btnSize} icon={<Check size={14} />} onClick={handleEndFlow} disabled={!currentNode} style={btnStyle}>
              结束流转
            </Button>
          </div>
        </div>

        {/* ─── React Flow canvas ─── */}
        <div
          style={{
            position: 'relative',
            height: canvasHeight,
            borderRadius: 8,
            overflow: 'hidden',
            background: token.colorBgLayout,
          }}
        >
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
            minZoom={0.3}
            maxZoom={1.5}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            elementsSelectable={false}
            panOnDrag
            panOnScroll
            zoomOnScroll={false}
            zoomOnPinch
            zoomOnDoubleClick={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={token.colorBorderSecondary} />
          </ReactFlow>

          <FitViewButton />
        </div>

        {/* ─── Choice modal ─── */}
        <Modal
          title="选择下一阶段"
          open={choiceModalOpen}
          onCancel={() => setChoiceModalOpen(false)}
          footer={null}
          width={360}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
            {choiceOptions.map((phase) => {
              const meta = phaseConfig[phase];
              return (
                <button
                  key={phase}
                  onClick={() => {
                    setChoiceModalOpen(false);
                    void advanceTo(phase);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    background: token.colorBgContainer,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = token.colorFillQuaternary; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = token.colorBgContainer; }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: meta.bg, flexShrink: 0 }} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </Modal>

        {/* ─── Branch creation modal ─── */}
        <Modal
          title="旁生分支 — 转投"
          open={branchModalOpen}
          onCancel={() => setBranchModalOpen(false)}
          onOk={handleCreateBranch}
          okText="创建"
          cancelText="取消"
          width={400}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, marginBottom: 4, color: token.colorTextSecondary }}>分支名称</div>
              <Input
                placeholder="如：转投 CVPR 2024"
                value={branchLabel}
                onChange={(e) => setBranchLabel(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <div style={{ fontSize: 13, marginBottom: 4, color: token.colorTextSecondary }}>转投起始阶段</div>
              <Select
                value={branchStartPhase}
                onChange={(v) => setBranchStartPhase(v)}
                style={{ width: '100%' }}
                virtual={false}
                options={BRANCH_START_PHASES.map((phase) => ({
                  value: phase,
                  label: phaseConfig[phase].label,
                }))}
              />
            </div>
          </div>
        </Modal>
      </div>
    </ReactFlowProvider>
  );
}

export const ProgressGraph = memo(ProgressGraphComp);
