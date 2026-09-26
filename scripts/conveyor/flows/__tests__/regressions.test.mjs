// Would the flow checker have caught 2026-09-26's daemon breaks? Each case runs the checker over the REAL flow
// and over a variant patched to the code before the fix (or after a proposed fix), and asserts the gap shows up
// exactly on the broken side. See ../test-fixtures/regressions.mjs for the cited reconstruction of each variant.
import { describe, it, expect } from 'vitest';
import { loadFlows, checkFlow } from '../flow-model.mjs';
import {
  before2701BuildDispatch, before2701Fix, before2701CiHeal, before93b2d603aConflict, before759529ac0Rebuild,
  offLockSmoke2731Rebuild, fixedStackedRetargetCiHeal,
} from '../test-fixtures/regressions.mjs';

const real = Object.fromEntries(loadFlows().map((f) => [f.id, f]));
const has = (flow, rule, where, text) => checkFlow(flow).some(
  (f) => f.rule === rule && f.where === where && (!text || f.message.includes(text)),
);

describe('#2701 — sessions moved to a scratch cwd lost edit permission on their lane', () => {
  it('build dispatch: clean before #2701, flagged after', () => {
    expect(has(before2701BuildDispatch(real['build-dispatch']), 'unprovided-assumption', 'step first-edit-in-lane')).toBe(false);
    expect(has(real['build-dispatch'], 'unprovided-assumption', 'step first-edit-in-lane', 'permission:edit:<lane>')).toBe(true);
  });
  it('fix: clean before #2701, flagged after', () => {
    expect(has(before2701Fix(real.fix), 'unprovided-assumption', 'step fixer-acquires-own-lane')).toBe(false);
    expect(has(real.fix, 'unprovided-assumption', 'step fixer-acquires-own-lane', 'permission:edit:<lane>')).toBe(true);
  });
  it('ci-heal: clean before #2701, flagged after', () => {
    expect(has(before2701CiHeal(real['ci-heal']), 'unprovided-assumption', 'step reconstitute-and-repair')).toBe(false);
    expect(has(real['ci-heal'], 'unprovided-assumption', 'step reconstitute-and-repair', 'permission:edit:<lane>')).toBe(true);
  });
});

describe('#2731 — the off-lock smoke ran the candidate in a different env (lane-pool root)', () => {
  it('clean on main (smoke in the real clone), flagged on the off-lock variant', () => {
    expect(has(real['daemon-rebuild'], 'unprovided-assumption', 'step run-live-smoke-checks')).toBe(false);
    const off = offLockSmoke2731Rebuild(real['daemon-rebuild']);
    expect(has(off, 'unprovided-assumption', 'step run-live-smoke-checks', 'lane:pool root = <workspace>/.lanes')).toBe(true);
    expect(has(off, 'unprovided-assumption', 'step run-live-smoke-checks', 'cwd:<daemon-clone>')).toBe(true);
  });
});

describe('#2729 — a stacked PR retargeted to main never re-ran CI (still open on main)', () => {
  it('flagged on main: no owner, unbounded wait, and the CI fact is missing on the retarget path', () => {
    const ci = real['ci-heal'];
    expect(has(ci, 'no-owner', 'state base-retargeted')).toBe(true);
    expect(has(ci, 'unbounded-wait', 'state base-retargeted')).toBe(true);
    expect(has(ci, 'unprovided-assumption', 'step evaluate-required-check', 'ci:required checks ran on head')).toBe(true);
    expect(has(real['drain-land'], 'no-owner', 'state accepted-unchecked-no-ci')).toBe(true);
  });
  it('clean once the retarget re-triggers checks and owns a bounded wait', () => {
    const fixed = fixedStackedRetargetCiHeal(real['ci-heal']);
    expect(has(fixed, 'no-owner', 'state base-retargeted')).toBe(false);
    expect(has(fixed, 'unbounded-wait', 'state base-retargeted')).toBe(false);
    expect(has(fixed, 'unprovided-assumption', 'step evaluate-required-check')).toBe(false);
  });
});

describe('states with no owner — a conflicting PR with no review label (fixed in 93b2d603a)', () => {
  it('flagged before, clean after', () => {
    expect(has(before93b2d603aConflict(real.conflict), 'no-owner', 'state unowned-mechanical-rebase-attempt')).toBe(true);
    expect(has(real.conflict, 'no-owner', 'state unowned-mechanical-rebase-attempt')).toBe(false);
  });
});

describe('waits with no bound — the clone writer lock (fixed in 759529ac0) and the overlay add', () => {
  it('writer lock: flagged before, clean after', () => {
    expect(has(before759529ac0Rebuild(real['daemon-rebuild']), 'unbounded-wait', 'state acquire-write-lock')).toBe(true);
    expect(has(real['daemon-rebuild'], 'unbounded-wait', 'state acquire-write-lock')).toBe(false);
  });
  it('overlay add: bounded on main, but its timeout still ends silently (flagged)', () => {
    expect(has(real['daemon-rebuild'], 'unbounded-wait', 'state operator-registers-overlay')).toBe(false);
    expect(has(real['daemon-rebuild'], 'silent-failure', 'state cli-overlay-op-failed')).toBe(true);
  });
});

describe('owed-ci-rerun — now has an actor, but its wait is still unbounded', () => {
  it('flagged on main as an unbounded wait', () => {
    expect(has(real['ci-heal'], 'unbounded-wait', 'state owed-ci-rerun-wait')).toBe(true);
  });
});
