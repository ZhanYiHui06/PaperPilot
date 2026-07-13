import type { ExperimentResultTable } from './ExperimentResultsEditor';

/**
 * Detects whether the metrics JSON field uses the new structured format
 * (methods × metrics matrix) or the legacy flat key-value format.
 */
export function parseResultsTable(
  metrics: Record<string, unknown> | null | undefined,
): ExperimentResultTable | null {
  if (!metrics) return null;
  // New format: has metric_names (array) and methods (array)
  if (
    Array.isArray((metrics as Record<string, unknown>).metric_names) &&
    Array.isArray((metrics as Record<string, unknown>).methods)
  ) {
    const raw = metrics as unknown as ExperimentResultTable;
    return {
      metric_names: raw.metric_names.map(String),
      methods: raw.methods.map((m) => ({
        name: String(m.name ?? ''),
        values: Array.isArray(m.values) ? m.values.map(String) : [],
      })),
    };
  }
  return null;
}

/**
 * Converts legacy flat key-value metrics to the new table format for display.
 * e.g. { accuracy: 0.95, f1: 0.88 } → { metric_names: ['accuracy', 'f1'], methods: [] }
 */
export function legacyToTable(
  metrics: Record<string, unknown> | null | undefined,
): ExperimentResultTable | null {
  if (!metrics) return null;
  const entries = Object.entries(metrics).filter(([, v]) => v !== null && v !== undefined);
  if (entries.length === 0) return null;
  return {
    metric_names: entries.map(([k]) => k),
    methods: [], // Legacy format has no method rows — values are shown as column headers
  };
}
