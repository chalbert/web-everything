/**
 * renderReport — v1 reusable renderers for the Web Reporting report model (backlog #432, phase 2 of
 * #350). Two views over the normalized report model the #431 `report-model` protocol fixes:
 *
 *   - {@link renderFindingsTable} — a findings table (the `check:standards` shape): one row per
 *     {@link Finding}, its severity shown through the Status Indicator block (one consistent token, not a
 *     bespoke per-screen colour), with location, rule, and source.
 *   - {@link renderCoverageMatrix} — a coverage matrix (the `check:app-conformance` shape): a rows ×
 *     columns grid of {@link CoverageCell}s, each a status token. {@link coverageFromScores} pivots a
 *     section's `scores[]` (whose ids follow a `"row/col"` convention) into that grid, so the matrix is
 *     driven by the model like the /protocols/ + /intents/ catalogs render from JSON.
 *
 * Schema-only standard: the report model IS the contract (producers emit it, renderers/adapters read it).
 * These renders own the DISPLAY only. Trend/burndown + score-card renderers follow once a producer emits
 * series data (#350 phase 2 tail). Pure string renderers, like {@link ../decision-trace/renderDecisionTrace}.
 */
import { statusIndicatorHTML, type StatusTone } from '../status-indicator/renderStatusIndicator';

// ── The report model (mirrors the #431 report-model protocol schema) ─────────────

/** Base severity vocabulary — producers extend with their own strings (the Decision-Record pattern). */
export type Severity = 'error' | 'warn' | 'info' | 'pass';

export interface ReportSource {
  id: string;
  name: string;
  kind?: string;
  at?: string;
  meta?: Record<string, string>;
}

export interface Finding {
  id: string;
  severity: Severity | string;
  title: string;
  detail?: string;
  location?: { path: string; line?: number; col?: number };
  ruleId?: string;
  /** → {@link ReportSource.id}. */
  source: string;
}

export interface Score {
  id: string;
  label: string;
  value: number;
  max?: number;
  unit?: string;
}

export interface Series {
  id: string;
  label: string;
  points: { at: string; value: number }[];
  unit?: string;
}

export interface ReportSection {
  id: string;
  title: string;
  findings?: Finding[];
  scores?: Score[];
  series?: Series[];
}

export interface Report {
  id: string;
  title: string;
  sources: ReportSource[];
  sections: ReportSection[];
  generatedAt?: string;
}

// ── Severity → status tone (one consistent token across every report view) ───────

/** Map a severity to a Status Indicator tone; an unknown (producer-extended) severity stays neutral. */
export function severityTone(severity: string): StatusTone {
  switch (severity) {
    case 'error': return 'critical';
    case 'warn': return 'caution';
    case 'info': return 'info';
    case 'pass': return 'positive';
    default: return 'neutral';
  }
}

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function locationText(loc?: Finding['location']): string {
  if (!loc) return '';
  const ln = loc.line !== undefined ? `:${loc.line}${loc.col !== undefined ? `:${loc.col}` : ''}` : '';
  return `${loc.path}${ln}`;
}

// ── Findings table ───────────────────────────────────────────────────────────────

export interface FindingsTableOptions {
  /** Caption/label for the table (default "Findings"). */
  readonly label?: string;
  /** Show the source column (default true — a report can fold several producers). */
  readonly showSource?: boolean;
}

/**
 * Render a findings list as an accessible table — one row per finding, severity as a Status Indicator
 * token. Findings are shown in the order given (the producer's order); sort upstream if needed.
 */
export function renderFindingsTable(findings: readonly Finding[], opts: FindingsTableOptions = {}): string {
  const label = opts.label ?? 'Findings';
  const showSource = opts.showSource ?? true;
  const head = [
    '<th scope="col">Severity</th>',
    '<th scope="col">Finding</th>',
    '<th scope="col">Location</th>',
    '<th scope="col">Rule</th>',
    showSource ? '<th scope="col">Source</th>' : '',
  ].join('');
  const rows = findings.map((f) => {
    const tone = severityTone(f.severity);
    const sev = statusIndicatorHTML({ label: String(f.severity), tone, shape: 'dot' });
    const loc = locationText(f.location);
    return `<tr>
      <td class="report-severity">${sev}</td>
      <td class="report-title">${esc(f.title)}${f.detail ? `<span class="report-detail">${esc(f.detail)}</span>` : ''}</td>
      <td class="report-location">${loc ? `<code>${esc(loc)}</code>` : ''}</td>
      <td class="report-rule">${f.ruleId ? `<code>${esc(f.ruleId)}</code>` : ''}</td>
      ${showSource ? `<td class="report-source">${esc(f.source)}</td>` : ''}
    </tr>`;
  });
  const empty = `<tr><td class="report-empty" colspan="${showSource ? 5 : 4}">No findings.</td></tr>`;
  return `<table class="report-findings" aria-label="${esc(label)}">
    <thead><tr>${head}</tr></thead>
    <tbody>${rows.length ? rows.join('') : empty}</tbody>
  </table>`;
}

// ── Coverage matrix ───────────────────────────────────────────────────────────────

/** One cell of a coverage matrix: a label (the level/score) and a tone (its pass/partial/fail token). */
export interface CoverageCell {
  readonly label: string;
  readonly tone?: StatusTone;
}

export interface CoverageMatrix {
  readonly rows: readonly { id: string; label: string }[];
  readonly columns: readonly { id: string; label: string }[];
  /** Cell at (rowId, colId), or undefined for an empty cell (not covered). */
  readonly cell: (rowId: string, colId: string) => CoverageCell | undefined;
}

export interface CoverageMatrixOptions {
  readonly label?: string;
}

/** Render a coverage matrix as an accessible grid — rows × columns, each covered cell a status token. */
export function renderCoverageMatrix(matrix: CoverageMatrix, opts: CoverageMatrixOptions = {}): string {
  const label = opts.label ?? 'Coverage';
  const head = `<tr><th scope="col"></th>${matrix.columns
    .map((c) => `<th scope="col">${esc(c.label)}</th>`)
    .join('')}</tr>`;
  const body = matrix.rows
    .map((r) => {
      const cells = matrix.columns
        .map((c) => {
          const cell = matrix.cell(r.id, c.id);
          if (!cell) return '<td class="report-cell report-cell-empty" aria-label="not covered">—</td>';
          return `<td class="report-cell">${statusIndicatorHTML({ label: cell.label, tone: cell.tone ?? 'neutral', shape: 'dot' })}</td>`;
        })
        .join('');
      return `<tr><th scope="row">${esc(r.label)}</th>${cells}</tr>`;
    })
    .join('');
  return `<table class="report-coverage" aria-label="${esc(label)}">
    <thead>${head}</thead>
    <tbody>${body}</tbody>
  </table>`;
}

/**
 * Pivot a section's `scores[]` into a {@link CoverageMatrix}. Score ids follow a `"row/col"` convention
 * (e.g. `"banking-app/aria-sort"`), so a flat score list materializes the (entity × capability) grid the
 * coverage matrix renders — model-driven, no separate matrix type in the protocol. A score's `tone` is
 * derived from `value` vs `max` (≥max → positive, >0 → caution, else critical) when `toneOf` is omitted.
 */
export function coverageFromScores(
  scores: readonly Score[],
  toneOf?: (score: Score) => StatusTone,
): CoverageMatrix {
  const rowOrder: string[] = [];
  const colOrder: string[] = [];
  const byCell = new Map<string, Score>();
  for (const s of scores) {
    const [row, col] = s.id.includes('/') ? s.id.split('/', 2) : [s.id, s.label];
    if (!rowOrder.includes(row)) rowOrder.push(row);
    if (!colOrder.includes(col)) colOrder.push(col);
    byCell.set(`${row} ${col}`, s);
  }
  const defaultTone = (s: Score): StatusTone => {
    if (s.max !== undefined) return s.value >= s.max ? 'positive' : s.value > 0 ? 'caution' : 'critical';
    return s.value > 0 ? 'positive' : 'critical';
  };
  return {
    rows: rowOrder.map((id) => ({ id, label: id })),
    columns: colOrder.map((id) => ({ id, label: id })),
    cell: (rowId, colId) => {
      const s = byCell.get(`${rowId} ${colId}`);
      if (!s) return undefined;
      const label = s.unit ? `${s.value}${s.unit}` : String(s.value);
      return { label, tone: (toneOf ?? defaultTone)(s) };
    },
  };
}
