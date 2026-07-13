import type { ProjectPhase } from '@shared/types';

interface PhaseMeta {
  label: string;
  /** LobeUI tag color name — used by ProgressGraph branch modal select etc. */
  color: string;
  /** Explicit pill background for the solid status tag on ProjectCard.
   *  10 hues spread across the color wheel so adjacent phases are visually
   *  distinct: gray → blue → teal → gold → pink → violet → red → orange → sky → green */
  bg: string;
}

export const phaseConfig: Record<ProjectPhase, PhaseMeta> = {
  ideation:       { label: '选题',   color: 'gray',       bg: '#475569' }, // slate
  coding:         { label: '编码',   color: 'blue',       bg: '#2563eb' }, // blue
  experiment:     { label: '实验',   color: 'cyan',       bg: '#0d9488' }, // teal
  writing:        { label: '撰写',   color: 'gold',       bg: '#ca8a04' }, // gold (brighter, more yellow — maximally distinct from blue)
  pending_submit: { label: '待投稿', color: 'magenta',    bg: '#db2777' }, // pink
  submitted:      { label: '已投稿', color: 'purple',     bg: '#7c3aed' }, // violet
  rejected:       { label: '被拒稿', color: 'red',        bg: '#dc2626' }, // red
  pending_revise: { label: '待返修', color: 'orange',     bg: '#ea580c' }, // orange
  revised:        { label: '已返修', color: 'geekblue',   bg: '#0369a1' }, // sky (shifted from cyan to avoid teal confusion)
  accepted:       { label: '已录用', color: 'green',      bg: '#16a34a' }, // green
};

// Core path phases — pre-created when a project is initialised.
// Post-submission phases (rejected, pending_revise, revised, accepted) are
// created dynamically by user actions, not pre-seeded.
export const CORE_PHASE_ORDER: ProjectPhase[] = [
  'ideation',
  'coding',
  'experiment',
  'writing',
  'pending_submit',
  'submitted',
];

// Legacy export — some code may still reference this. Maps to core path only.
export const PHASE_ORDER = CORE_PHASE_ORDER;

// Phases that represent a terminal state (no further "下一阶段").
export const TERMINAL_PHASES: Set<ProjectPhase> = new Set(['accepted', 'rejected']);

// Phases from which a 旁生分支 (resubmission branch) can be created.
export const BRANCHABLE_PHASES: Set<ProjectPhase> = new Set(['rejected']);

// Given the current phase, return the set of possible next phases the user
// can transition to. Returns an empty array for terminal or unknown phases.
export function nextPhaseOptions(phase: ProjectPhase): ProjectPhase[] {
  switch (phase) {
    case 'ideation':       return ['coding'];
    case 'coding':         return ['experiment'];
    case 'experiment':     return ['writing'];
    case 'writing':        return ['pending_submit'];
    case 'pending_submit': return ['submitted'];
    case 'submitted':      return ['accepted', 'rejected', 'pending_revise'];
    case 'pending_revise': return ['revised'];
    case 'revised':        return ['accepted', 'rejected'];
    // Terminal phases — no next
    default:               return [];
  }
}
