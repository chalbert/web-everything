/**
 * @file scripts/readiness/__tests__/overlap-chain.test.mjs
 * @description Unit proof of #2394's pure overlap-stacking planner (`overlap-chain.mjs`): selective
 *   union-find chaining on DECLARED file-sets (sibling / stack-on-frontier / bridge), the depth cap's
 *   sibling fallback + re-root, the capability gate's hard default to siblings, and the push-time
 *   `actual ⊆ declared` re-check verdicts (clean / undeclared-disjoint / rebase-required) with the
 *   apply-rebase repair loop. The git/fs boundary lives in `we:scripts/lane-stack.mjs`, e2e-proven in
 *   `we:scripts/__tests__/lane-stack-e2e.test.mjs`.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DEPTH_CAP, createStackPlan, planNextItem, recheckAtPush, applyRebase, recordPushed, dropItem,
} from '../overlap-chain.mjs';

const push = (plan, id, files = [], tips = { we: { sha: `sha-${id}`, ref: `lane/x-${id}` } }) =>
  recordPushed(plan, { id, actualFiles: files, tips });

describe('capability gate (#2387 F4) — default hard to siblings', () => {
  it('plans every item a sibling when unsupported, even with obvious overlap', () => {
    const plan = createStackPlan({ supported: false });
    const a = planNextItem(plan, { id: 'A', files: ['we:shared.txt'] });
    push(plan, 'A', ['we:shared.txt']);
    const b = planNextItem(plan, { id: 'B', files: ['we:shared.txt'] });
    expect(a.stacked).toBe(false);
    expect(b.stacked).toBe(false);
    expect(b.stackParents).toEqual([]);
    expect(b.reason).toMatch(/stacking-unsupported/);
  });

  it('disarms the rebase directive at recheck (a rebase would CREATE an ungated stacked PR)', () => {
    const plan = createStackPlan({ supported: false });
    planNextItem(plan, { id: 'A', files: ['we:shared.txt'] });
    push(plan, 'A', ['we:shared.txt']);
    planNextItem(plan, { id: 'B', files: ['we:b.txt'] });
    const v = recheckAtPush(plan, { id: 'B', actualFiles: ['we:b.txt', 'we:shared.txt'] });
    expect(v.ok).toBe(true);
    expect(v.verdict).toBe('stacking-unsupported');
    expect(v.undeclared).toEqual(['we:shared.txt']); // still reported for the ledger
    expect(v.onto).toEqual([]);
  });
});

describe('selective chaining (#2387 F1)', () => {
  it('overlap stacks on the frontier tip; disjoint stays a sibling; frontier advances per push', () => {
    const plan = createStackPlan({ supported: true });
    const a = planNextItem(plan, { id: 'A', files: ['we:shared.txt', 'we:a.txt'] });
    expect(a.stacked).toBe(false);
    push(plan, 'A', ['we:shared.txt', 'we:a.txt']);

    const b = planNextItem(plan, { id: 'B', files: ['we:shared.txt', 'we:b.txt'] });
    expect(b.stacked).toBe(true);
    expect(b.base).toBe('A');
    expect(b.stackParents).toEqual(['A']);
    expect(b.baseTips).toEqual({ we: { sha: 'sha-A', ref: 'lane/x-A' } }); // the concrete acquire --base
    push(plan, 'B', ['we:shared.txt', 'we:b.txt']);

    const d = planNextItem(plan, { id: 'D', files: ['we:d.txt'] });
    expect(d.stacked).toBe(false); // provably disjoint — sibling off origin/main even mid-chain

    const c = planNextItem(plan, { id: 'C', files: ['we:shared.txt', 'we:c.txt'] });
    expect(c.base).toBe('B'); // the frontier moved past A
    expect(c.stackParents).toEqual(['B']);
  });

  it('stacks on files a predecessor ACTUALLY touched, not just declared (recordPushed absorbs actuals)', () => {
    const plan = createStackPlan({ supported: true });
    planNextItem(plan, { id: 'A', files: ['we:a.txt'] });
    push(plan, 'A', ['we:a.txt', 'we:surprise.txt']); // undeclared-disjoint excess, pushed anyway
    const b = planNextItem(plan, { id: 'B', files: ['we:surprise.txt'] });
    expect(b.stacked).toBe(true);
    expect(b.base).toBe('A');
  });

  it('the same path in two repos never collides (repo-qualified sets)', () => {
    const plan = createStackPlan({ supported: true });
    planNextItem(plan, { id: 'A', files: ['we:src/index.ts'] });
    push(plan, 'A', ['we:src/index.ts']);
    const b = planNextItem(plan, { id: 'B', files: ['frontierui:src/index.ts'] });
    expect(b.stacked).toBe(false);
  });

  it('a bridging item merges two chains and records BOTH frontier tips as stackParents', () => {
    const plan = createStackPlan({ supported: true });
    planNextItem(plan, { id: 'A', files: ['we:a.txt'] });
    push(plan, 'A', ['we:a.txt']);
    planNextItem(plan, { id: 'B', files: ['we:b.txt'] });
    push(plan, 'B', ['we:b.txt']);

    const e = planNextItem(plan, { id: 'E', files: ['we:a.txt', 'we:b.txt'] });
    expect(e.stacked).toBe(true);
    expect(new Set(e.stackParents)).toEqual(new Set(['A', 'B']));
    expect(e.mergeParents.length).toBe(1); // base on one tip, merge the other in-session
    push(plan, 'E', ['we:a.txt', 'we:b.txt']);

    // The chains fused: an item touching either side now stacks on the bridge, one chain.
    const f = planNextItem(plan, { id: 'F', files: ['we:b.txt'] });
    expect(f.base).toBe('E');
    expect(f.stackParents).toEqual(['E']);
  });

  it('an unpushed (dropped) root is overlap-visible but never stacked on', () => {
    const plan = createStackPlan({ supported: true });
    planNextItem(plan, { id: 'A', files: ['we:a.txt'] });
    dropItem(plan, { id: 'A' }); // gate-red / carried — no PR, no tip
    const b = planNextItem(plan, { id: 'B', files: ['we:a.txt'] });
    expect(b.stacked).toBe(false);
    expect(b.reason).toMatch(/no pushed frontier/);
  });
});

describe('depth cap — sibling fallback + re-root', () => {
  it(`defaults to ${DEFAULT_DEPTH_CAP} and falls back to a sibling past the cap, re-rooting the chain`, () => {
    const plan = createStackPlan({ supported: true, depthCap: 2 });
    planNextItem(plan, { id: 'A', files: ['we:shared.txt'] });
    push(plan, 'A', ['we:shared.txt']);
    const b = planNextItem(plan, { id: 'B', files: ['we:shared.txt'] });
    expect(b.stacked).toBe(true);
    push(plan, 'B', ['we:shared.txt']);

    const c = planNextItem(plan, { id: 'C', files: ['we:shared.txt'] });
    expect(c.stacked).toBe(false); // depth would be 3 > cap 2
    expect(c.reason).toMatch(/depth cap/);
    push(plan, 'C', ['we:shared.txt']);

    // Re-root: the next overlapping item stacks on C's new shallow chain, not the over-deep one.
    const d = planNextItem(plan, { id: 'D', files: ['we:shared.txt'] });
    expect(d.stacked).toBe(true);
    expect(d.base).toBe('C');
    expect(d.stackParents).toEqual(['C']);
  });
});

describe('push-time recheck (#2387 F1 — actual ⊆ declared)', () => {
  const chainPlusSibling = () => {
    const plan = createStackPlan({ supported: true });
    planNextItem(plan, { id: 'A', files: ['we:shared.txt'] });
    push(plan, 'A', ['we:shared.txt']);
    planNextItem(plan, { id: 'E', files: ['we:e.txt'] }); // declared-disjoint sibling
    return plan;
  };

  it('clean when actual ⊆ declared', () => {
    const v = recheckAtPush(chainPlusSibling(), { id: 'E', actualFiles: ['we:e.txt'] });
    expect(v).toMatchObject({ ok: true, verdict: 'clean', undeclared: [] });
  });

  it('undeclared-disjoint when the excess overlaps no other chain (push, absorb at record)', () => {
    const v = recheckAtPush(chainPlusSibling(), { id: 'E', actualFiles: ['we:e.txt', 'we:new-file.txt'] });
    expect(v.ok).toBe(true);
    expect(v.verdict).toBe('undeclared-disjoint');
    expect(v.undeclared).toEqual(['we:new-file.txt']);
  });

  it('rebase-required when the excess overlaps another chain — names the frontier tip + its acquire ref', () => {
    const v = recheckAtPush(chainPlusSibling(), { id: 'E', actualFiles: ['we:e.txt', 'we:shared.txt'] });
    expect(v.ok).toBe(false);
    expect(v.verdict).toBe('rebase-required');
    expect(v.undeclared).toEqual(['we:shared.txt']);
    expect(v.onto).toEqual(['A']);
    expect(v.ontoTips.A).toEqual({ we: { sha: 'sha-A', ref: 'lane/x-A' } });
  });

  it('apply-rebase repairs the plan so the re-run recheck passes and stackParents feed the manifest', () => {
    const plan = chainPlusSibling();
    const v = recheckAtPush(plan, { id: 'E', actualFiles: ['we:e.txt', 'we:shared.txt'] });
    expect(v.ok).toBe(false);
    applyRebase(plan, { id: 'E', onto: v.onto, actualFiles: ['we:e.txt', 'we:shared.txt'] });
    expect(plan.items.E.stackParents).toEqual(['A']);
    expect(plan.items.E.sibling).toBe(false);
    const again = recheckAtPush(plan, { id: 'E', actualFiles: ['we:e.txt', 'we:shared.txt'] });
    expect(again.ok).toBe(true);
    // And the fused chain has ONE frontier going forward.
    push(plan, 'E', ['we:e.txt', 'we:shared.txt']);
    const f = planNextItem(plan, { id: 'F', files: ['we:shared.txt'] });
    expect(f.base).toBe('E');
  });

  it("an item's overlap with its OWN chain (its parents' files) is never a violation", () => {
    const plan = createStackPlan({ supported: true });
    planNextItem(plan, { id: 'A', files: ['we:shared.txt'] });
    push(plan, 'A', ['we:shared.txt']);
    planNextItem(plan, { id: 'B', files: ['we:shared.txt', 'we:b.txt'] }); // stacked on A
    const v = recheckAtPush(plan, { id: 'B', actualFiles: ['we:shared.txt', 'we:b.txt'] });
    expect(v.ok).toBe(true);
    expect(v.verdict).toBe('clean');
  });
});

describe('plan round-trips through JSON (the CLI persists it between seams)', () => {
  it('survives serialize/parse mid-flight with identical downstream decisions', () => {
    let plan = createStackPlan({ supported: true });
    planNextItem(plan, { id: 'A', files: ['we:shared.txt'] });
    push(plan, 'A', ['we:shared.txt']);
    plan = JSON.parse(JSON.stringify(plan));
    const b = planNextItem(plan, { id: 'B', files: ['we:shared.txt'] });
    expect(b.stacked).toBe(true);
    expect(b.base).toBe('A');
    expect(b.baseTips.we.sha).toBe('sha-A');
  });
});
