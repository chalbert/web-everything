/**
 * @file scripts/conveyor/__tests__/fix-dispatch-queue-cap.test.mjs
 * @description Card xkyw1x4 — the fix-dispatch daemon's `queue-cap` hook: `runReconcileFixDispatch` and
 *   `runReconcileCiHealDispatch` admit each owed fix / CI-heal only while the projected heavy-test queue wait stays
 *   ≤ the max, and a budget shared across both passes sees every dispatch before it. Every read is a stub — no
 *   real GitHub, lane pool or host queue.
 */
import { describe, it, expect } from 'vitest';
import { runReconcileFixDispatch, queueBudgetFrom } from '../reconcile-fix-dispatch.mjs';
import { runReconcileCiHealDispatch } from '../../operations/ci-heal-pr-dispatch.mjs';

const FRESH = () => ({ fresh: true, behind: 0 });
const item = { num: '3438', slug: 'wire-reconcile-pass', specPath: 'backlog/3438-wire-reconcile-pass.md', scope: ['we:scripts/conveyor/reconcile-fix-dispatch.mjs'] };
const findItemStub = (key) => (key === '3438' ? item : null);
const fixEntries = (prs) => prs.map((pr, i) => ({ kind: 'fix', prNumber: pr, headRefName: `lane/3438-wire-reconcile-pass-${i}` }));
const reconcileStub = (entries) => () => ({ dispatch: entries, refusals: [], notes: [], prs: entries.length, agents: 0 });
const WE_PROFILE = () => ({ capabilities: { fix: true, ciHeal: true }, lanePoolRepo: '.' });

function runFix(prs, queueAdmission) {
  const dispatched = [];
  const result = runReconcileFixDispatch({
    root: '/repo',
    reconcile: reconcileStub(fixEntries(prs)),
    findItemFn: findItemStub,
    loadItems: () => [],
    pickFreeLanes: () => [2, 3, 4, 5],
    resolveProfile: WE_PROFILE,
    dispatch: (planned) => { dispatched.push(planned.pr); return { sessionSlug: `fix-${planned.pr}`, pr: planned.pr, lane: planned.lane }; },
    checkStaleness: FRESH,
    queueAdmission,
  });
  return { dispatched, result };
}

describe('runReconcileFixDispatch — queue-cap', () => {
  it('no queueAdmission (the default) — every owed fix dispatches, as before', () => {
    const { dispatched, result } = runFix([1, 2, 3, 4], undefined);
    expect(dispatched).toEqual([1, 2, 3, 4]);
    expect(result.refusals).toEqual([]);
  });

  it('4 fixes owed at once on a busy queue: the one that would push the projection past 30m is refused queue-cap', () => {
    // (50 + 3.25n) / 2 → 26.63, 28.25, 29.88, 31.5
    const { dispatched, result } = runFix([1, 2, 3, 4], { slots: 2, backlogMinutes: 50, maxWaitMinutes: 30 });
    expect(dispatched).toEqual([1, 2, 3]);
    expect(result.refusals).toEqual([{ pr: 4, kind: 'queue-cap', why: expect.stringContaining('projected heavy-test queue wait 31.5m would exceed 30m') }]);
  });

  it('the baseline may be a function (read once per pass); a throwing reader fails open', () => {
    let reads = 0;
    const { dispatched } = runFix([1, 2], () => { reads += 1; return { slots: 1, backlogMinutes: 100 }; });
    expect(reads).toBe(1);
    expect(dispatched).toEqual([]);
    expect(runFix([1, 2], () => { throw new Error('pool unreadable'); }).dispatched).toEqual([1, 2]);
  });
});

describe('runReconcileCiHealDispatch — queue-cap, sharing ONE budget with the fix pass', () => {
  it('a CI-heal is costed like a fix and sees the fixes admitted before it in the same daemon pass', async () => {
    const budget = queueBudgetFrom({ slots: 2, backlogMinutes: 50, maxWaitMinutes: 30 });
    const fix = runFix([1, 2], budget); // → 26.63, 28.25 — both admitted
    expect(fix.dispatched).toEqual([1, 2]);
    const healed = [];
    const result = await runReconcileCiHealDispatch({
      root: '/repo',
      reconcile: () => ({ dispatch: [{ kind: 'ci-heal', prNumber: 50, headRefName: 'lane/x' }, { kind: 'ci-heal', prNumber: 51, headRefName: 'lane/y' }], refusals: [] }),
      resolveProfile: WE_PROFILE,
      resolveWorkUnit: () => ({ itemNum: null, scope: [] }),
      pickFreeLanes: () => [7, 8],
      dispatch: async (planned) => { healed.push(planned.pr); return { sessionSlug: `ci-heal-${planned.pr}`, pr: planned.pr, lane: planned.lane }; },
      checkStaleness: FRESH,
      queueAdmission: budget,
    });
    // 3rd dispatch of the pass → 29.88 admitted; 4th → 31.5 refused.
    expect(healed).toEqual([50]);
    expect(result.refusals).toEqual([{ pr: 51, kind: 'queue-cap', why: expect.stringContaining('31.5m') }]);
  });
});
