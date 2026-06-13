/**
 * Web Reporting v1 renderers (backlog #432). Proves the findings table (severity → status token, location,
 * source, empty state) and the coverage matrix (rows × columns grid, empty cells, the score-pivot adapter
 * + its default tone derivation) over the #431 report model.
 */
import { describe, it, expect } from 'vitest';
import {
  renderFindingsTable,
  renderCoverageMatrix,
  coverageFromScores,
  severityTone,
  type Finding,
  type Score,
} from '../../../renderers/report/renderReport';

const findings: Finding[] = [
  { id: 'f1', severity: 'error', title: 'Missing aria-sort', location: { path: 'a.ts', line: 12 }, ruleId: 'aria-sort', source: 'check:standards' },
  { id: 'f2', severity: 'warn', title: 'Digest too long', source: 'check:standards' },
  { id: 'f3', severity: 'custom-sev', title: 'Producer-extended severity', source: 'ext' },
];

describe('severityTone', () => {
  it('maps the base vocabulary, neutral for an unknown (extended) severity', () => {
    expect(severityTone('error')).toBe('critical');
    expect(severityTone('warn')).toBe('caution');
    expect(severityTone('info')).toBe('info');
    expect(severityTone('pass')).toBe('positive');
    expect(severityTone('whatever')).toBe('neutral');
  });
});

describe('renderFindingsTable', () => {
  it('renders one row per finding with severity, title, location, rule, source', () => {
    const html = renderFindingsTable(findings);
    expect(html).toContain('Missing aria-sort');
    expect(html).toContain('<code>a.ts:12</code>');
    expect(html).toContain('check:standards');
    expect(html).toContain('aria-sort');
    // 3 data rows
    expect(html.match(/<tr>/g)!.length).toBe(4); // 1 head + 3 body
  });

  it('shows an empty state when there are no findings', () => {
    expect(renderFindingsTable([])).toContain('No findings.');
  });

  it('omits the source column when showSource is false', () => {
    const html = renderFindingsTable(findings, { showSource: false });
    expect(html).not.toContain('<th scope="col">Source</th>');
  });

  it('escapes finding titles', () => {
    const html = renderFindingsTable([{ id: 'x', severity: 'info', title: '<script>alert(1)</script>', source: 's' }]);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('coverageFromScores + renderCoverageMatrix', () => {
  const scores: Score[] = [
    { id: 'banking/aria-sort', label: 'aria-sort', value: 2, max: 2 }, // full → positive
    { id: 'banking/anchor', label: 'anchor', value: 1, max: 2 },       // partial → caution
    { id: 'loan/aria-sort', label: 'aria-sort', value: 0, max: 2 },    // none → critical
  ];

  it('pivots "row/col"-keyed scores into the (entity × capability) grid', () => {
    const matrix = coverageFromScores(scores);
    expect(matrix.rows.map((r) => r.id)).toEqual(['banking', 'loan']);
    expect(matrix.columns.map((c) => c.id)).toEqual(['aria-sort', 'anchor']);
    expect(matrix.cell('banking', 'aria-sort')).toEqual({ label: '2', tone: 'positive' });
    expect(matrix.cell('banking', 'anchor')!.tone).toBe('caution');
    expect(matrix.cell('loan', 'aria-sort')!.tone).toBe('critical');
  });

  it('returns undefined for an uncovered cell', () => {
    const matrix = coverageFromScores(scores);
    expect(matrix.cell('loan', 'anchor')).toBeUndefined();
  });

  it('renders the grid with a dash for uncovered cells', () => {
    const html = renderCoverageMatrix(coverageFromScores(scores));
    expect(html).toContain('<th scope="row">banking</th>');
    expect(html).toContain('report-cell-empty'); // loan × anchor is uncovered
    expect(html).toContain('aria-sort');
  });

  it('honours a custom toneOf', () => {
    const matrix = coverageFromScores(scores, () => 'info');
    expect(matrix.cell('banking', 'aria-sort')!.tone).toBe('info');
  });
});
