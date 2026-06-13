/**
 * Web Reporting v1 INGEST adapters (backlog #433). Proves SARIF 2.1.0 → Report (run → source+section,
 * level → severity, location), JUnit XML → Report (suite → section, failure/pass → severity), and
 * Istanbul coverage-summary → Report (file × metric → scores), plus an export→ingest round-trip over the
 * #431 report model.
 */
import { describe, it, expect } from 'vitest';
import {
  fromSarif,
  fromJUnit,
  fromCoverage,
  sarifLevelToSeverity,
  type CoverageSummary,
} from '../../../adapters/report/ingestReport';
import { toSarif, toJUnit, type SarifLog } from '../../../adapters/report/exportReport';
import { coverageFromScores, type Report } from '../../../renderers/report/renderReport';

const report: Report = {
  id: 'r1',
  title: 'Conformance run',
  sources: [
    { id: 'check:standards', name: 'check:standards' },
    { id: 'ext', name: 'External tool' },
  ],
  sections: [
    {
      id: 'sec1',
      title: 'Standards',
      findings: [
        { id: 'f1', severity: 'error', title: 'Missing aria-sort', detail: 'add it', location: { path: 'a.ts', line: 12, col: 4 }, ruleId: 'aria-sort', source: 'check:standards' },
        { id: 'f2', severity: 'warn', title: 'Digest too long', source: 'check:standards' },
        { id: 'f3', severity: 'pass', title: 'All good', source: 'check:standards' },
      ],
    },
    {
      id: 'sec2',
      title: 'External',
      findings: [{ id: 'f4', severity: 'info', title: 'FYI', source: 'ext' }],
    },
  ],
};

describe('sarifLevelToSeverity', () => {
  it('inverts the level mapping', () => {
    expect(sarifLevelToSeverity('error')).toBe('error');
    expect(sarifLevelToSeverity('warning')).toBe('warn');
    expect(sarifLevelToSeverity('note')).toBe('info');
    expect(sarifLevelToSeverity('none')).toBe('pass');
  });
});

describe('fromSarif', () => {
  const log: SarifLog = toSarif(report);
  const back = fromSarif(log);

  it('makes one source + section per run, findings keyed to the source', () => {
    // SARIF carries only the tool NAME (not our internal source id), so ingest keys by name —
    // lossy-by-design, but internally consistent (findings reference the same id).
    expect(back.sources.map((s) => s.id)).toEqual(['check:standards', 'External tool']);
    expect(back.sections).toHaveLength(2);
    expect(back.sections[0].findings).toHaveLength(3);
    expect(back.sections[0].findings!.every((f) => f.source === 'check:standards')).toBe(true);
  });

  it('maps level → severity and physicalLocation → location', () => {
    const first = back.sections[0].findings![0];
    expect(first.severity).toBe('error');
    expect(first.ruleId).toBe('aria-sort');
    expect(first.location).toEqual({ path: 'a.ts', line: 12, col: 4 });
  });
});

describe('fromJUnit', () => {
  const xml = toJUnit(report);
  const back = fromJUnit(xml);

  it('makes one section per suite with a single run source', () => {
    expect(back.title).toBe('Conformance run');
    expect(back.sources).toEqual([{ id: 'junit', name: 'JUnit', kind: 'junit' }]);
    expect(back.sections.map((s) => s.title)).toEqual(['Standards', 'External']);
  });

  it('recovers the original severity from a <failure> type, pass for a passing case', () => {
    const std = back.sections[0].findings!;
    expect(std.find((f) => f.title === 'Missing aria-sort')?.severity).toBe('error');
    expect(std.find((f) => f.title === 'Digest too long')?.severity).toBe('warn');
    expect(std.find((f) => f.title === 'All good')?.severity).toBe('pass');
    expect(std.find((f) => f.title === 'Missing aria-sort')?.detail).toBe('add it');
  });

  it('unescapes XML metacharacters back to text', () => {
    const x = toJUnit({ id: 'x', title: 'A & B', sources: [{ id: 's', name: 's' }],
      sections: [{ id: 'se', title: '<unsafe>', findings: [{ id: 'f', severity: 'error', title: 'a < b & "c"', detail: 'd & e', source: 's' }] }] });
    const r = fromJUnit(x);
    expect(r.title).toBe('A & B');
    expect(r.sections[0].title).toBe('<unsafe>');
    expect(r.sections[0].findings![0].title).toBe('a < b & "c"');
    expect(r.sections[0].findings![0].detail).toBe('d & e');
  });
});

describe('fromCoverage', () => {
  const summary: CoverageSummary = {
    total: {
      lines: { total: 100, covered: 92, pct: 92 },
      statements: { total: 100, covered: 90, pct: 90 },
      functions: { total: 20, covered: 20, pct: 100 },
      branches: { total: 40, covered: 30, pct: 75 },
    },
    'src/deep/path/foo.ts': { lines: { total: 10, covered: 5, pct: 50 } },
  };
  const r = fromCoverage(summary);

  it('emits file × metric scores keyed row/col, basename rows', () => {
    const scores = r.sections[0].scores!;
    const total = scores.find((s) => s.id === 'total/lines');
    expect(total).toMatchObject({ value: 92, max: 100, unit: '%' });
    expect(scores.find((s) => s.id === 'foo.ts/lines')?.value).toBe(50);
  });

  it('pivots straight into the coverage matrix', () => {
    const matrix = coverageFromScores(r.sections[0].scores!);
    expect(matrix.rows.map((x) => x.id)).toEqual(['total', 'foo.ts']);
    expect(matrix.columns.map((x) => x.id)).toContain('lines');
    expect(matrix.cell('total', 'functions')?.tone).toBe('positive'); // 100/100
    expect(matrix.cell('total', 'branches')?.tone).toBe('caution');   // 75/100
  });
});
