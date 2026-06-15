/**
 * buildReport helper (backlog #435, slice A of #350 phase 5). Proves the shared producer-side
 * constructor (`scripts/lib/buildReport.mjs`) emits a report that is model-valid by the #431 contract:
 * it pipes unchanged through the #432 renderers (`renderFindingsTable`) and the #434 export adapters
 * (`toSarif` / `toJUnit`), and its invariants reject malformed producer input. This is the regression
 * guard that the `check:standards --json` migration (and the sibling B/C/D reporter slices) rests on.
 */
import { describe, it, expect } from 'vitest';
// The producer side is plain JS (the model is a plain-object contract); the consumer side is the TS
// renderers/adapters — this test bridges them exactly as a real producer → consumer pipeline does.
import {
  buildReport,
  source,
  finding,
  section,
  score,
  series,
} from '../../../../scripts/lib/buildReport.mjs';
import { renderFindingsTable } from '../../../renderers/report/renderReport';
import { toSarif, toJUnit } from '../../../adapters/report/exportReport';

// A report shaped like the `check:standards --json` producer: one validator source, a findings section
// mixing an error (with a descriptor → ruleId + location) and a bare warning.
const report = buildReport({
  id: 'check-standards',
  title: 'Web Everything — check:standards',
  sources: [source({ id: 'check-standards', name: 'check:standards', kind: 'validator' })],
  sections: [
    section({
      id: 'findings',
      title: 'Standards conformance findings',
      findings: [
        finding({
          id: 'check-standards/error/0',
          severity: 'error',
          title: 'Missing required field "summary"',
          ruleId: 'missing-required-field',
          location: { path: 'src/_data/backlog.json' },
          source: 'check-standards',
        }),
        finding({
          id: 'check-standards/warn/0',
          severity: 'warn',
          title: 'Digest too long',
          source: 'check-standards',
        }),
      ],
    }),
  ],
});

describe('buildReport — model-valid output', () => {
  it('drops undefined optional keys (only present fields survive)', () => {
    const s = source({ id: 'x', name: 'X' });
    expect(s).toEqual({ id: 'x', name: 'X' });
    expect('kind' in s).toBe(false);
    const f = finding({ id: 'f', severity: 'warn', title: 't', source: 'x' });
    expect('location' in f).toBe(false);
    expect('ruleId' in f).toBe(false);
  });

  it('pipes through the #432 findings-table renderer', () => {
    const html = renderFindingsTable(report.sections[0].findings);
    expect(html).toContain('Missing required field');
    expect(html).toContain('src/_data/backlog.json');
    expect(html).toContain('missing-required-field');
    expect(html).not.toContain('No findings.');
  });

  it('pipes through the #434 SARIF adapter (one run per source, one result per finding)', () => {
    const sarif = toSarif(report);
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0].results).toHaveLength(2);
    expect(sarif.runs[0].results[0].level).toBe('error');
  });

  it('pipes through the #434 JUnit adapter', () => {
    const xml = toJUnit(report);
    expect(xml).toContain('<testsuite');
    expect(xml).toContain('Digest too long');
  });
});

describe('buildReport — invariants reject malformed input', () => {
  it('requires the model fields', () => {
    expect(() => source({ name: 'no id' } as never)).toThrow(/source.id/);
    expect(() => finding({ id: 'f', severity: 'warn', title: 't' } as never)).toThrow(/finding.source/);
    expect(() => score({ id: 's', label: 'l' } as never)).toThrow(/score.value/);
    expect(() => series({ id: 's', label: 'l' } as never)).toThrow(/series.points/);
  });

  it('rejects a finding that references an undeclared source', () => {
    expect(() =>
      buildReport({
        id: 'r',
        title: 'R',
        sources: [source({ id: 'known', name: 'Known' })],
        sections: [section({ id: 'sec', title: 'Sec', findings: [finding({ id: 'f', severity: 'warn', title: 't', source: 'ghost' })] })],
      }),
    ).toThrow(/unknown source "ghost"/);
  });
});
