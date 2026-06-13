/**
 * Web Compliance gate runner (backlog #437). Proves the policy `extends` resolution (project delta wins
 * per id), the threshold comparison (numeric / `L<n>` level / equality / presence), and the gate verdict:
 * a block-severity violation fails CI, error/warn report-but-pass, off disables, missing measures flag.
 */
import { describe, it, expect } from 'vitest';
import {
  resolvePolicy,
  clears,
  runGate,
  type CompliancePolicy,
} from '../gate';

const baseline: CompliancePolicy = {
  id: 'platform-default',
  version: '1',
  rules: [
    { id: 'aria-sort', measure: 'app-conformance:aria-sort', severity: 'block', threshold: 'L2' },
    { id: 'coverage', measure: 'coverage:lines', severity: 'warn', threshold: 80 },
  ],
};

describe('resolvePolicy (extends)', () => {
  it('flattens the chain, a project rule replacing the baseline rule of the same id', () => {
    const project: CompliancePolicy = {
      id: 'my-app', version: '2', extends: baseline,
      rules: [
        { id: 'coverage', measure: 'coverage:lines', severity: 'block', threshold: 90 }, // override
        { id: 'no-skip', measure: 'tests:skipped', severity: 'block', threshold: 0 },     // add
      ],
    };
    const resolved = resolvePolicy(project);
    expect(resolved.map((r) => r.id).sort()).toEqual(['aria-sort', 'coverage', 'no-skip']);
    expect(resolved.find((r) => r.id === 'coverage')!.severity).toBe('block'); // project won
    expect(resolved.find((r) => r.id === 'coverage')!.threshold).toBe(90);
  });
});

describe('clears (threshold comparison)', () => {
  it('numeric thresholds compare with >=', () => {
    expect(clears(85, 80)).toBe(true);
    expect(clears(79, 80)).toBe(false);
  });
  it('L-level thresholds compare by rank', () => {
    expect(clears('L2', 'L2')).toBe(true);
    expect(clears('L3', 'L2')).toBe(true);
    expect(clears('L1', 'L2')).toBe(false);
  });
  it('other strings compare by equality; a missing threshold is a presence check', () => {
    expect(clears('green', 'green')).toBe(true);
    expect(clears('red', 'green')).toBe(false);
    expect(clears('anything', undefined)).toBe(true);
    expect(clears(undefined, undefined)).toBe(false);
  });
});

describe('runGate', () => {
  it('passes when every block rule clears its threshold', () => {
    const r = runGate(baseline, [
      { measure: 'app-conformance:aria-sort', value: 'L2' },
      { measure: 'coverage:lines', value: 95 },
    ]);
    expect(r.passed).toBe(true);
    expect(r.blocked).toBe(false);
    expect(r.violations).toHaveLength(0);
  });

  it('blocks (fails CI) when a block-severity rule is violated', () => {
    const r = runGate(baseline, [
      { measure: 'app-conformance:aria-sort', value: 'L1' }, // below L2, severity block
      { measure: 'coverage:lines', value: 95 },
    ]);
    expect(r.blocked).toBe(true);
    expect(r.passed).toBe(false);
    expect(r.violations.map((v) => v.rule.id)).toEqual(['aria-sort']);
    expect(r.violations[0].reason).toBe('below-threshold');
  });

  it('a warn-severity violation is reported but does NOT fail the gate', () => {
    const r = runGate(baseline, [
      { measure: 'app-conformance:aria-sort', value: 'L2' },
      { measure: 'coverage:lines', value: 50 }, // below 80, but severity warn
    ]);
    expect(r.blocked).toBe(false);
    expect(r.passed).toBe(true);
    expect(r.violations.map((v) => v.rule.id)).toEqual(['coverage']);
  });

  it('flags a missing measure as a violation', () => {
    const r = runGate(baseline, [{ measure: 'coverage:lines', value: 95 }]);
    const aria = r.violations.find((v) => v.rule.id === 'aria-sort')!;
    expect(aria.reason).toBe('missing-measure');
    expect(r.blocked).toBe(true);
  });

  it('an off-severity rule is not evaluated', () => {
    const policy: CompliancePolicy = {
      id: 'p', version: '1',
      rules: [{ id: 'aria-sort', measure: 'app-conformance:aria-sort', severity: 'off', threshold: 'L2' }],
    };
    const r = runGate(policy, []); // measure absent, but rule is off
    expect(r.evaluated).toHaveLength(0);
    expect(r.violations).toHaveLength(0);
    expect(r.passed).toBe(true);
  });
});
