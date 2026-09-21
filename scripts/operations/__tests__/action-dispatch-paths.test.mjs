/** #3383 — Exercise each real dispatch boundary with fakes; holds must remain ordinary non-dispatches. */
import { it, expect, vi } from 'vitest';
import { createActionStore, CoordinationUnavailableError } from '../action-store.mjs';
import { actionResource } from '../action-record.mjs';
import { createDispatchSinks } from '../dispatch-lane-io.mjs';
import { DISPATCH_EFFECT } from '../dispatch-lane.mjs';
import { dispatchReview, dispatchReviewCli } from '../review-dispatch.mjs';
import { dispatchFix, tryResumeFix, runReconcileFixDispatch } from '../../conveyor/reconcile-fix-dispatch.mjs';
import { buildAuthorActorMarker } from '../../lib/review-independence.mjs';
import { advance, startRun } from '../engine.mjs';
import { createRegistry, op } from '../registry.mjs';
import { effect } from '../step-kinds.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import { applyPendingEffects } from '../effect-executor.mjs';
import { createLandAdvanceApplier } from '../land-advance-io.mjs';
const resource = actionResource('we', { type: 'pr', id: 77 });
const reviewBrief = '# Review {{PR}} {{REPO}} {{SESSION_SLUG}}';
const fixBrief = '# Fix {{ITEM_NUM}} {{PR_NUM}} {{LANE_REF}} {{LANE}} {{SESSION_SLUG}} {{SCOPE}}';
const planned = { pr: 77, itemNum: 'xone', laneRef: 'lane/xone-test', lane: 1, scope: ['we:scripts/'] };
const refusalStore = { claim: () => { throw new CoordinationUnavailableError('/tmp/test-actions', new Error('EACCES')); } };
it.each(['held', 'unavailable'])('review, fix and dispatch-lane all refuse %s before their provider', async (reason) => {
  const real = createActionStore();
  real.claim({ resource, kind: 'fix', owner: 'other' });
  const actions = reason === 'held' ? real : refusalStore;
  const spawnAgent = vi.fn(() => 'backgrounded · aabbccdd · review-77');
  const sink = createDispatchSinks({ root: '/fake-primary', actions, provider: spawnAgent });
  expect(await sink[DISPATCH_EFFECT]({ pr: 77, num: 'xone', launchKind: 'ci-heal', prompt: '# repair' })).toMatchObject({ held: true, reason });
  expect(dispatchReview({ pr: 77, repo: 'we', root: '/fake-primary', actions, spawnAgent,
    checkStaleness: () => ({ fresh: true }), readBrief: () => reviewBrief })).toMatchObject({ held: true, reason });
  expect(dispatchFix(planned, { root: '/fake-primary', actions, spawnAgent, readBrief: () => fixBrief })).toMatchObject({ held: true, reason });
  const candidate = 'cand-0000-0000-0000-000000000000';
  expect(tryResumeFix({ ...planned, isConflict: true, body: buildAuthorActorMarker(candidate), headRefOid: 'head' }, {
    root: '/fake-primary', actions, spawnAgent,
    listAgentsAll: () => [{ sessionId: candidate, id: 'candxxxx', cwd: '/fake-lane', name: 'conveyor-xone' }],
    resolveHead: () => 'head', wait: () => {}, stop: () => {},
  })).toMatchObject({ resumed: false, held: true, reason });
  const cli = dispatchReviewCli(['--pr=77', '--repo=chalbert/web-everything'], { actions, dispatchMechanical: spawnAgent, write: () => {}, writeErr: () => {} });
  expect(cli).toMatchObject({ code: 75, mode: 'held' });
  expect(spawnAgent).not.toHaveBeenCalled();
});
it('a review blocks a fix on the same PR; a FOREIGN repo is refused before the record is ever consulted', () => {
  const actions = createActionStore();
  const spawnAgent = vi.fn(() => 'backgrounded · aabbccdd · review-77');
  dispatchReview({ pr: 77, repo: 'we', root: '/fake-primary', actions, spawnAgent, checkStaleness: () => ({ fresh: true }), readBrief: () => reviewBrief });
  expect(dispatchFix(planned, { root: '/fake-primary', actions, spawnAgent, readBrief: () => fixBrief }).held).toBe(true);
  // CATCH-UP MERGE (2026-09-21): this case used to assert that the SAME PR number in ANOTHER repo dispatches
  // independently of the WE action record. `main` has since made `dispatchFix` refuse any repo but WE outright
  // (`unsupported-repo` — a foreign fix needs its own brief and gate), and that refusal fires at the top of the
  // function, BEFORE the record is read. So the foreign half is now asserted as the refusal it actually is; the
  // record's own repo-independence is no longer exercisable from here and is recorded in this merge's report.
  expect(() => dispatchFix(planned, { repo: 'frontierui', root: '/fake-primary', actions, spawnAgent, readBrief: () => fixBrief }))
    .toThrow(/unsupported-repo/);
  expect(spawnAgent).toHaveBeenCalledTimes(1);
});
it.each(['held', 'unavailable'])('land-advance defers %s without errors or a follow-up ledger entry', async (reason) => {
  const writeLedger = vi.fn();
  const apply = createLandAdvanceApplier({ writeLedger, dispatchReview: () => ({ dispatched: false, held: true, reason }), readCapacity: () => ({ sessions: [], freeLanes: 1, load: 0 }) });
  const result = await apply({ errors: [], rows: [], capacity: { budget: 1 }, proposed: [{ subject: 'we#77', pr: 77, slug: 'chalbert/web-everything', owedAction: 'dispatch-review' }] });
  expect(result.errors).toEqual([]);
  expect(result.deferred).toEqual([{ target: 'we#77', reason: reason === 'held' ? 'held-by-action-record' : 'coordination-unavailable' }]);
  expect(writeLedger).not.toHaveBeenCalled();
});
it('a held fix becomes a refusal row, not a dispatch failure', () => {
  const result = runReconcileFixDispatch({ root: '/fake-primary', checkStaleness: () => ({ fresh: true }),
    reconcile: () => ({ dispatch: [{ kind: 'fix', prNumber: 77, headRefName: 'lane/3438-test' }], refusals: [] }),
    findItemFn: () => ({ num: '3438', scope: ['we:scripts/'] }), loadItems: () => [], pickFreeLanes: () => [1],
    dispatch: () => ({ held: true, reason: 'unavailable' }) });
  expect(result.refusals).toEqual([{ pr: 77, kind: 'held', why: 'unavailable' }]);
  expect(result.dispatched).toEqual([]);
});

it.each(['held', 'unavailable'])('the operation executor records %s as a non-dispatch without an error', async (reason) => {
  const registry = createRegistry();
  registry.register(op('fixture-dispatch', { go: effect({ effects: () => [{ type: DISPATCH_EFFECT,
    payload: { pr: 77, num: 'xone', launchKind: 'fix', prompt: '# fix' }, dispatch: true, idempotent: false }] }) }));
  const run = advance(startRun({ id: 'run-held', op: 'fixture-dispatch', registry }), { registry });
  run.verdict = { dispatching: true };
  const store = createMemoryRunStore(); store.write(run);
  const actions = reason === 'held' ? createActionStore() : refusalStore;
  if (reason === 'held') actions.claim({ resource, kind: 'review', owner: 'other' });
  const provider = vi.fn();
  const out = await applyPendingEffects(run, { store, sinks: createDispatchSinks({ root: '/fake-primary', actions, provider }) });
  expect(out.error).toBeNull();
  expect(out.run.verdict).toMatchObject({ dispatching: false, holdReason: reason === 'held' ? 'held-by-action-record' : 'coordination-unavailable' });
  expect(out.run.effects[0]).toMatchObject({ status: 'applied', result: { dispatched: false, held: true } });
  expect(provider).not.toHaveBeenCalled();
});
it('refuses a dispatch with no item/PR identity before any spawn, as a retryable non-dispatch', async () => {
  const provider = vi.fn(() => 'pid:1');
  const sink = createDispatchSinks({ root: '/tmp/no-identity-primary', provider, actions: createActionStore({ root: '/tmp/no-identity-actions' }) });
  await expect(sink[DISPATCH_EFFECT]({ launchKind: 'build' })).rejects.toMatchObject({ notApplied: true });
  expect(provider).not.toHaveBeenCalled();
});
