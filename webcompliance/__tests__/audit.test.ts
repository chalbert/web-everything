/**
 * Audit / evidence trail (backlog #439). Proves the defensible record — what was enforced, when, against
 * which policy version, with what result — maps onto the canonical Web Reporting {@link Report} model: a
 * single audit source stamped with the policy id+version+time, a verdict score block, and sections for
 * violations / waived / expired / passes, so the report renderers + export adapters consume it unchanged.
 */
import { describe, it, expect } from 'vitest';
import { runGate, type CompliancePolicy, type Measure } from '../gate';
import { applyWaivers, type Waiver } from '../waiver';
import { recordAudit, auditToReport } from '../audit';

const policy: CompliancePolicy = {
  id: 'platform-default',
  version: '3',
  rules: [
    { id: 'aria-sort', measure: 'app-conformance:aria-sort', severity: 'block', threshold: 'L2' },
    { id: 'coverage', measure: 'coverage:lines', severity: 'warn', threshold: 80 },
    { id: 'no-skip', measure: 'tests:skipped', severity: 'block', threshold: 0 },
  ],
};

// aria-sort fails (L1 < L2), coverage fails (70 < 80), no-skip passes (0 >= 0... threshold 0 = presence-ish).
const measures: Measure[] = [
  { measure: 'app-conformance:aria-sort', value: 'L1' },
  { measure: 'coverage:lines', value: 70 },
  { measure: 'tests:skipped', value: 0 },
];

describe('recordAudit', () => {
  it('captures policy identity + time + verdict (no clock read — at is supplied)', () => {
    const result = runGate(policy, measures);
    const record = recordAudit(policy, result, '2026-06-13T10:00:00Z');
    expect(record.policyId).toBe('platform-default');
    expect(record.policyVersion).toBe('3');
    expect(record.at).toBe('2026-06-13T10:00:00Z');
    expect(record.result).toBe(result);
  });
});

describe('auditToReport — emit through Web Reporting', () => {
  it('maps a raw gate result onto the Report model (one audit source, verdict scores, violation+pass sections)', () => {
    const result = runGate(policy, measures);
    const report = auditToReport(recordAudit(policy, result, '2026-06-13T10:00:00Z'));

    expect(report.id).toBe('compliance-audit:platform-default@3');
    expect(report.generatedAt).toBe('2026-06-13T10:00:00Z');
    expect(report.sources).toHaveLength(1);
    expect(report.sources[0]).toMatchObject({ id: 'webcompliance', kind: 'audit', meta: { policy: 'platform-default', version: '3', verdict: 'blocked' } });

    const summary = report.sections.find((s) => s.id === 'summary')!;
    const scoreVal = (id: string) => summary.scores!.find((sc) => sc.id === id)!.value;
    expect(scoreVal('evaluated')).toBe(3);
    expect(scoreVal('violations')).toBe(2); // aria-sort + coverage
    expect(scoreVal('blocked')).toBe(1);    // aria-sort is block severity

    const violations = report.sections.find((s) => s.id === 'violations')!;
    expect(violations.findings).toHaveLength(2);
    // block-severity violation surfaces as a report 'error'; warn stays 'warn'.
    expect(violations.findings!.find((f) => f.ruleId === 'aria-sort')!.severity).toBe('error');
    expect(violations.findings!.find((f) => f.ruleId === 'coverage')!.severity).toBe('warn');

    const passes = report.sections.find((s) => s.id === 'passes')!;
    expect(passes.findings!.map((f) => f.ruleId)).toEqual(['no-skip']);
  });

  it('records waived overrides and expired waivers as audit findings, not failures', () => {
    const result = runGate(policy, measures);
    const waivers: Waiver[] = [
      { ruleId: 'aria-sort', who: 'lead@x', why: 'tracked in #999', until: '2026-12-31' }, // active
      { ruleId: 'coverage', who: 'lead@x', why: 'stale', until: '2025-01-01' },             // expired
    ];
    const waivered = applyWaivers(result, waivers, '2026-06-13T10:00:00Z');
    const report = auditToReport(recordAudit(policy, waivered, '2026-06-13T10:00:00Z'));

    // active aria-sort waiver moves it off violations → gate no longer blocked.
    expect(report.sources[0].meta!.verdict).toBe('passed');
    const waived = report.sections.find((s) => s.id === 'waived')!;
    expect(waived.findings!.map((f) => f.ruleId)).toEqual(['aria-sort']);
    expect(waived.findings![0].severity).toBe('info');
    expect(waived.findings![0].detail).toContain('lead@x');

    const expired = report.sections.find((s) => s.id === 'expired-waivers')!;
    expect(expired.findings!.map((f) => f.ruleId)).toEqual(['coverage']);
    expect(expired.findings![0].severity).toBe('warn');
  });

  it('includePasses:false yields a failures-only view', () => {
    const result = runGate(policy, measures);
    const report = auditToReport(recordAudit(policy, result, '2026-06-13T10:00:00Z'), { includePasses: false });
    expect(report.sections.find((s) => s.id === 'passes')).toBeUndefined();
  });
});
