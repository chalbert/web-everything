/**
 * Seed compliance policy (backlog #440). Proves the platform's hard CI gates, re-expressed as declared
 * policy data, gate correctly through the #437 runner: a clean run (every gate signalling 1) passes; a
 * standards failure (the block-severity conformance gate at 0) blocks CI; a readiness-only failure
 * reports without blocking (warn severity); and a project policy can `extends` the baseline.
 */
import { describe, it, expect } from 'vitest';
import { runGate, resolvePolicy, type CompliancePolicy, type Measure } from '../gate';
import { platformDefaultPolicy } from '../policies/platform-default';

const clean: Measure[] = [
  { measure: 'check-standards:pass', value: 1 },
  { measure: 'check-standards:backlog-pass', value: 1 },
  { measure: 'check-readiness:well-formed', value: 1 },
];

describe('platformDefaultPolicy — seed gate set as data', () => {
  it('is a root baseline (extends nothing) and resolves to its declared rules', () => {
    expect(platformDefaultPolicy.extends).toBeUndefined();
    const ids = resolvePolicy(platformDefaultPolicy).map((r) => r.id);
    expect(ids).toEqual(['standards-conformance', 'backlog-well-formed', 'readiness-structural']);
  });

  it('passes when every gate signals 1 (zero errors)', () => {
    const result = runGate(platformDefaultPolicy, clean);
    expect(result.passed).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.violations).toHaveLength(0);
  });

  it('blocks CI when the standards conformance gate fails', () => {
    const result = runGate(platformDefaultPolicy, [...clean.slice(1), { measure: 'check-standards:pass', value: 0 }]);
    expect(result.blocked).toBe(true);
    expect(result.violations.map((v) => v.rule.id)).toContain('standards-conformance');
  });

  it('reports but does not block when only the readiness scan fails (warn severity)', () => {
    const result = runGate(platformDefaultPolicy, [...clean.slice(0, 2), { measure: 'check-readiness:well-formed', value: 0 }]);
    expect(result.blocked).toBe(false); // warn-severity violation reports, does not fail CI
    expect(result.violations.map((v) => v.rule.id)).toEqual(['readiness-structural']);
  });

  it('a project policy extends the baseline, its delta winning per id', () => {
    const project: CompliancePolicy = {
      id: 'my-app',
      version: '1',
      extends: platformDefaultPolicy,
      rules: [
        // promote the readiness scan to a hard gate for this project
        { id: 'readiness-structural', measure: 'check-readiness:well-formed', severity: 'block', threshold: 1 },
      ],
    };
    const result = runGate(project, [...clean.slice(0, 2), { measure: 'check-readiness:well-formed', value: 0 }]);
    expect(result.blocked).toBe(true); // project override made it blocking
  });
});
