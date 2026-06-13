/**
 * Web Compliance waivers (backlog #438). Proves an active waiver suppresses a block-severity violation
 * (CI passes, but it's recorded in waived[] for audit), an expired waiver does NOT suppress (still blocks)
 * and is surfaced in expiredWaivers[], and the verdict is recomputed over the remaining violations.
 */
import { describe, it, expect } from 'vitest';
import { runGate, type CompliancePolicy } from '../gate';
import { applyWaivers, isActive, type Waiver } from '../waiver';

const policy: CompliancePolicy = {
  id: 'p',
  version: '1',
  rules: [
    { id: 'aria-sort', measure: 'app:aria-sort', severity: 'block' },
    { id: 'contrast', measure: 'app:contrast', severity: 'warn' },
  ],
};
// Neither measure clears → both rules violate; the block rule fails the gate.
const result = runGate(policy, []);

const NOW = '2026-06-13';

describe('isActive', () => {
  it('is active before until, inert on/after it', () => {
    expect(isActive({ ruleId: 'x', who: 'a', why: 'b', until: '2026-06-20' }, NOW)).toBe(true);
    expect(isActive({ ruleId: 'x', who: 'a', why: 'b', until: '2026-06-13' }, NOW)).toBe(false);
    expect(isActive({ ruleId: 'x', who: 'a', why: 'b', until: '2026-06-01' }, NOW)).toBe(false);
  });
});

describe('applyWaivers', () => {
  it('an active waiver on a block rule unblocks CI but records it for audit', () => {
    expect(result.blocked).toBe(true); // precondition
    const waiver: Waiver = { ruleId: 'aria-sort', who: 'nic', why: 'vendor fix pending', until: '2026-07-01' };
    const r = applyWaivers(result, [waiver], NOW);
    expect(r.blocked).toBe(false);
    expect(r.passed).toBe(true);
    expect(r.waived).toHaveLength(1);
    expect(r.waived[0].rule.id).toBe('aria-sort');
    expect(r.waived[0].waiver.who).toBe('nic');
    // the still-unwaived warn violation remains (it never blocked anyway)
    expect(r.violations.map((v) => v.rule.id)).toEqual(['contrast']);
  });

  it('an expired waiver does NOT suppress — still blocks — and is surfaced for renewal', () => {
    const expired: Waiver = { ruleId: 'aria-sort', who: 'nic', why: 'stale', until: '2026-06-01' };
    const r = applyWaivers(result, [expired], NOW);
    expect(r.blocked).toBe(true);
    expect(r.waived).toHaveLength(0);
    expect(r.expiredWaivers).toEqual([expired]);
    expect(r.violations.map((v) => v.rule.id)).toEqual(['aria-sort', 'contrast']);
  });

  it('a waiver for an unrelated rule changes nothing', () => {
    const r = applyWaivers(result, [{ ruleId: 'nonexistent', who: 'x', why: 'y', until: '2026-07-01' }], NOW);
    expect(r.blocked).toBe(true);
    expect(r.waived).toHaveLength(0);
  });

  it('when two active waivers target one rule, the first in order is recorded', () => {
    const w1: Waiver = { ruleId: 'aria-sort', who: 'first', why: 'a', until: '2026-07-01' };
    const w2: Waiver = { ruleId: 'aria-sort', who: 'second', why: 'b', until: '2026-08-01' };
    const r = applyWaivers(result, [w1, w2], NOW);
    expect(r.waived[0].waiver.who).toBe('first');
  });
});
