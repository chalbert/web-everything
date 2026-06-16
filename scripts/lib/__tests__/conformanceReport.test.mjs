/**
 * buildConformanceReport — the #431 report-model view of check:app-conformance (slice C of #435; #711).
 * Proves the coverage-matrix scores[] + findings[] mapping, the --burndown series[], and model-validity
 * by piping through the #432 coverage renderer and the #434 SARIF/JUnit export adapters.
 */
import { describe, it, expect } from 'vitest';
import { buildConformanceReport } from '../conformanceReport.mjs';
import { coverageFromScores } from '../../../blocks/renderers/report/renderReport';
import { toSarif, toJUnit } from '../../../blocks/adapters/report/exportReport';

const conformance = [
  { id: 'data-table', status: 'conformant', severity: 'OK', at: null },
  { id: 'web-droplist', status: 'gap-declared', severity: 'GAP', at: 'demos/x/app.ts:12' },
  { id: 'web-foo', status: 'reimplemented', severity: 'FAIL', at: 'demos/x/app.ts:40' },
];
const burndown = [
  { date: '2026-06-01', score: 60, fails: 2, gaps: 1, candidates: 0 },
  { date: '2026-06-10', score: 80, fails: 1, gaps: 1, candidates: 0 },
];

describe('buildConformanceReport — coverage + trend', () => {
  it('maps each Layer-1 standard to a coverage score (OK→1, GAP→0.5, FAIL→0 against max 1)', () => {
    const r = buildConformanceReport('demos/x', conformance, []);
    const cov = r.sections.find((s) => s.id === 'coverage');
    const byId = Object.fromEntries(cov.scores.map((s) => [s.id, s.value]));
    expect(byId).toEqual({ 'data-table/conformance': 1, 'web-droplist/conformance': 0.5, 'web-foo/conformance': 0 });
    expect(cov.scores.every((s) => s.max === 1)).toBe(true);
  });

  it('emits each non-conformant standard as a finding (FAIL→error, GAP→warn) with its location', () => {
    const r = buildConformanceReport('demos/x', conformance, []);
    const findings = r.sections.find((s) => s.id === 'coverage').findings;
    expect(findings).toHaveLength(2); // the OK one is omitted
    expect(findings.find((f) => f.id === 'conformance/web-foo')).toMatchObject({ severity: 'error', location: { path: 'demos/x/app.ts', line: 40 } });
    expect(findings.find((f) => f.id === 'conformance/web-droplist').severity).toBe('warn');
  });

  it('maps the --burndown log to score/fails/gaps series (the burndown is part of this reporter)', () => {
    const r = buildConformanceReport('demos/x', conformance, burndown);
    const trend = r.sections.find((s) => s.id === 'trend');
    expect(trend.series.map((s) => s.id)).toEqual(['score', 'fails', 'gaps']);
    expect(trend.series.find((s) => s.id === 'score').points).toEqual([
      { at: '2026-06-01', value: 60 }, { at: '2026-06-10', value: 80 },
    ]);
    expect(trend.series.find((s) => s.id === 'score').unit).toBe('%');
  });

  it('omits series entirely when the app has no burndown history', () => {
    const r = buildConformanceReport('demos/x', conformance, []);
    expect(r.sections.find((s) => s.id === 'trend').series).toEqual([]);
  });

  it('coverage scores pivot through the #432 coverageFromScores matrix', () => {
    const r = buildConformanceReport('demos/x', conformance, []);
    const matrix = coverageFromScores(r.sections[0].scores);
    expect(matrix.rows.map((row) => row.id)).toEqual(['data-table', 'web-droplist', 'web-foo']);
    expect(matrix.cell('data-table', 'conformance').tone).toBe('positive');
    expect(matrix.cell('web-foo', 'conformance').tone).toBe('critical');
  });

  it('is model-valid: pipes unchanged through the #434 SARIF/JUnit export adapters', () => {
    const r = buildConformanceReport('demos/x', conformance, burndown);
    expect(toSarif(r).runs).toHaveLength(1);
    expect(() => toJUnit(r)).not.toThrow();
  });
});
