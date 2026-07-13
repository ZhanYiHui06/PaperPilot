import type {
  Project,
  ProgressNode,
  CodeVersion,
  Experiment,
  LatexVersion,
  Email,
} from '@shared/types';

export interface ExportData {
  project?: Project;
  progressNodes?: ProgressNode[];
  codeVersions?: CodeVersion[];
  experiments?: Experiment[];
  latexVersions?: LatexVersion[];
  emails?: Email[];
}

function escapeCell(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function fmt(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '\u2014';
  return escapeCell(value);
}

function fmtTags(tags: string[] | null | undefined): string {
  if (!tags || tags.length === 0) return '\u2014';
  return tags.map(escapeCell).join(', ');
}

function fmtJson(value: Record<string, unknown> | null | undefined): string {
  if (!value) return '\u2014';
  try {
    return '```json\n' + JSON.stringify(value, null, 2) + '\n```';
  } catch {
    return '\u2014';
  }
}

export function exportToJSON(data: ExportData): string {
  return JSON.stringify(data, null, 2);
}
export function exportToMarkdown(data: ExportData): string {
  const lines: string[] = [];
  const exportedAt = new Date().toISOString();

  const title = data.project?.title ?? 'PaperPilot Export';
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`> Exported at: ${exportedAt}`);
  lines.push('');

  if (data.project) {
    const p = data.project;
    lines.push('## Project Info');
    lines.push('');
    lines.push('| Field | Value |');
    lines.push('|-------|-------|');
    lines.push(`| ID | ${fmt(p.id)} |`);
    lines.push(`| Title | ${fmt(p.title)} |`);
    lines.push(`| Description | ${fmt(p.description)} |`);
    lines.push(`| Target Venue | ${fmt(p.target_venue)} |`);
    lines.push(`| Tags | ${fmtTags(p.tags)} |`);
    lines.push(`| Phase | ${fmt(p.phase)} |`);
    lines.push(`| Status | ${fmt(p.status)} |`);
    lines.push(`| Created At | ${fmt(p.created_at)} |`);
    lines.push(`| Updated At | ${fmt(p.updated_at)} |`);
    lines.push('');
  }

  if (data.progressNodes && data.progressNodes.length > 0) {
    lines.push('## Progress Nodes');
    lines.push('');
    lines.push('| Order | Label | Phase | Status | Created |');
    lines.push('|-------|-------|-------|--------|---------|');
    for (const n of data.progressNodes) {
      lines.push(
        `| ${n.order_index} | ${fmt(n.label)} | ${fmt(n.phase)} | ${fmt(n.status)} | ${fmt(n.created_at)} |`,
      );
    }
    lines.push('');
  }
  if (data.codeVersions && data.codeVersions.length > 0) {
    lines.push('## Code Versions');
    lines.push('');
    lines.push('| Version Label | Timestamp | Git Commit | Tags |');
    lines.push('|---------------|-----------|------------|------|');
    for (const v of data.codeVersions) {
      lines.push(
        `| ${fmt(v.version_label)} | ${fmt(v.timestamp)} | ${fmt(v.git_commit_hash)} | ${fmtTags(v.tags)} |`,
      );
    }
    lines.push('');
    for (const v of data.codeVersions) {
      lines.push(`### ${v.version_label}`);
      lines.push('');
      lines.push(`- **Timestamp**: ${v.timestamp}`);
      lines.push(`- **AI Summary**: ${v.ai_summary ?? '\u2014'}`);
      lines.push(`- **Git Commit**: ${v.git_commit_hash ?? '\u2014'}`);
      lines.push(`- **Tags**: ${v.tags && v.tags.length > 0 ? v.tags.join(', ') : '\u2014'}`);
      if (v.diff_text) {
        lines.push('');
        lines.push('```diff');
        lines.push(v.diff_text);
        lines.push('```');
      }
      lines.push('');
    }
  }
  if (data.experiments && data.experiments.length > 0) {
    lines.push('## Experiments');
    lines.push('');
    lines.push('| Name | Type | Dataset | Model | Status | Created |');
    lines.push('|------|------|---------|-------|--------|---------|');
    for (const e of data.experiments) {
      lines.push(
        `| ${fmt(e.name)} | ${fmt(e.experiment_type)} | ${fmt(e.dataset)} | ${fmt(e.model)} | ${fmt(e.status)} | ${fmt(e.created_at)} |`,
      );
    }
    lines.push('');
    for (const e of data.experiments) {
      lines.push(`### ${e.name}`);
      lines.push('');
      lines.push(`- **Type**: ${e.experiment_type}`);
      lines.push(`- **Dataset**: ${e.dataset ?? '\u2014'}`);
      lines.push(`- **Model**: ${e.model ?? '\u2014'}`);
      lines.push(`- **Status**: ${e.status}`);
      lines.push(`- **Created At**: ${e.created_at}`);
      if (e.hyperparameters) {
        lines.push('');
        lines.push('**Hyperparameters**');
        lines.push('');
        lines.push(fmtJson(e.hyperparameters as Record<string, unknown>));
        lines.push('');
      }
      if (e.metrics) {
        lines.push('**Metrics**');
        lines.push('');
        lines.push(fmtJson(e.metrics as Record<string, unknown>));
        lines.push('');
      }
      if (e.notes) {
        lines.push('**Notes**');
        lines.push('');
        lines.push(e.notes);
        lines.push('');
      }
    }
  }
  if (data.latexVersions && data.latexVersions.length > 0) {
    lines.push('## LaTeX Versions');
    lines.push('');
    lines.push('| Version Label | Timestamp | Git Commit |');
    lines.push('|---------------|-----------|------------|');
    for (const v of data.latexVersions) {
      lines.push(
        `| ${fmt(v.version_label)} | ${fmt(v.timestamp)} | ${fmt(v.git_commit_hash)} |`,
      );
    }
    lines.push('');
    for (const v of data.latexVersions) {
      lines.push(`### ${v.version_label}`);
      lines.push('');
      lines.push(`- **Timestamp**: ${v.timestamp}`);
      lines.push(`- **AI Summary**: ${v.ai_summary ?? '\u2014'}`);
      lines.push(`- **Git Commit**: ${v.git_commit_hash ?? '\u2014'}`);
      lines.push('');
    }
  }

  if (data.emails && data.emails.length > 0) {
    lines.push('## Emails');
    lines.push('');
    lines.push('| Subject | Sender | Received At | Type | Important | Read |');
    lines.push('|---------|--------|-------------|------|-----------|------|');
    for (const e of data.emails) {
      lines.push(
        `| ${fmt(e.subject)} | ${fmt(e.sender)} | ${fmt(e.received_at)} | ${fmt(e.email_type)} | ${e.is_important ? 'Yes' : 'No'} | ${e.is_read ? 'Yes' : 'No'} |`,
      );
    }
    lines.push('');
    for (const e of data.emails) {
      lines.push(`### ${e.subject}`);
      lines.push('');
      lines.push(`- **Sender**: ${e.sender}`);
      lines.push(`- **Received At**: ${e.received_at}`);
      lines.push(`- **Type**: ${e.email_type ?? '\u2014'}`);
      lines.push(`- **AI Summary**: ${e.ai_summary ?? '\u2014'}`);
      if (e.raw_content) {
        lines.push('');
        lines.push('```');
        lines.push(e.raw_content);
        lines.push('```');
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}