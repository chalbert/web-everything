/**
 * @file scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs — #3438: dispatch the fix agent
 *   `reconcile-pass.mjs` decides is owed for a bounced PR nothing live is working.
 *
 * NOTHING HERE SPAWNS A REAL PROCESS OR TOUCHES `gh`/`git`: every IO seam is injected (`spawnAgent`, `readBrief`,
 * `mintSessionId`, `pickFreeLanes`, `loadItems`, `checkStaleness`, `reconcile`), mirroring
 * `we:scripts/operations/__tests__/review-dispatch.test.mjs`'s own style for the sibling operation this file's
 * `dispatchFix` composition was mirrored from.
 */
import { describe, it, expect } from 'vitest';
import {
  dispatchFix, fixBriefPath, freeLaneNumbers, planFixesFromReconcile, runReconcileFixDispatch,
} from '../reconcile-fix-dispatch.mjs';

// A `checkStaleness` stub that never touches git — every test below injects one.
const FRESH = () => ({ fresh: true, behind: 0 });

const REAL_TEMPLATE_STUB = [
  '# fix brief for {{PR_NUM}} (item {{ITEM_NUM}})',
  'acquire: node scripts/lane-pool.mjs acquire --lane={{LANE}} --session={{SESSION_SLUG}} --scope={{SCOPE}} --base={{LANE_REF}}',
  'this brief documents {{LIKE_THIS}} as an example convention, not a real token',
].join('\n');

const item3438 = { num: '3438', slug: 'wire-reconcile-pass', specPath: 'backlog/3438-wire-reconcile-pass.md', scope: ['we:scripts/conveyor/reconcile-fix-dispatch.mjs'] };
const findItemStub = (key, _loadItems) => (key === '3438' ? item3438 : null);

describe('planFixesFromReconcile', () => {
  it('narrows to `kind:\'fix\'` entries and plans one per dispatchable PR', () => {
    const entries = [
      { kind: 'review', prNumber: 1, headRefName: 'lane/1-x' },
      { kind: 'fix', prNumber: 1764, headRefName: 'lane/3438-wire-reconcile-pass' },
    ];
    const { planned, refusals } = planFixesFromReconcile(entries, findItemStub, () => []);
    expect(refusals).toEqual([]);
    expect(planned).toEqual([{ itemNum: '3438', pr: 1764, laneRef: 'lane/3438-wire-reconcile-pass', scope: item3438.scope }]);
  });

  it('refuses `no-item-num` for a PR whose head ref carries no conveyor item number', () => {
    const entries = [{ kind: 'fix', prNumber: 42, headRefName: 'some-hand-opened-branch' }];
    const { planned, refusals } = planFixesFromReconcile(entries, findItemStub, () => []);
    expect(planned).toEqual([]);
    expect(refusals).toEqual([{ pr: 42, kind: 'no-item-num', why: expect.stringContaining('carries no conveyor item number') }]);
  });

  it('refuses `no-scope` for an item the loader cannot resolve, or one with an empty scope', () => {
    const entries = [{ kind: 'fix', prNumber: 99, headRefName: 'lane/9999-ghost' }];
    const { planned, refusals } = planFixesFromReconcile(entries, () => null, () => []);
    expect(planned).toEqual([]);
    expect(refusals).toEqual([{ pr: 99, kind: 'no-scope', why: expect.stringContaining('no declared scope') }]);
  });

  it('ignores non-`fix` entries entirely (a `review` entry is someone else\'s job)', () => {
    const { planned, refusals } = planFixesFromReconcile([{ kind: 'review', prNumber: 1, headRefName: 'lane/1-x' }], findItemStub, () => []);
    expect(planned).toEqual([]);
    expect(refusals).toEqual([]);
  });
});

describe('freeLaneNumbers', () => {
  it('parses lane ids out of `lane-pool.mjs list --acquirable --json` path output', () => {
    const calls = [];
    const exec = (file, argv) => {
      calls.push({ file, argv });
      return JSON.stringify(['/lanes/web-everything/lane-9', '/lanes/web-everything/lane-2', '/lanes/web-everything/lane-14']);
    };
    expect(freeLaneNumbers({ exec, root: '/repo' })).toEqual([2, 9, 14]);
    expect(calls).toHaveLength(1);
    expect(calls[0].file).toBe('node');
    expect(calls[0].argv).toEqual(['/repo/scripts/lane-pool.mjs', 'list', '--acquirable', '--json']);
  });

  it('fails soft to an empty list rather than throwing (a `gh`/pool hiccup must not crash the whole pass)', () => {
    const exec = () => { throw new Error('pool unreachable'); };
    expect(freeLaneNumbers({ exec, root: '/repo' })).toEqual([]);
  });
});

describe('dispatchFix — the composition: plan → fill → mint → spawn', () => {
  it('spawns exactly once, with a freshly minted session id, the assigned lane, and the filled brief as the prompt', () => {
    const calls = [];
    const result = dispatchFix(
      { itemNum: '3438', pr: 1764, laneRef: 'lane/3438-wire-reconcile-pass', scope: ['we:scripts/conveyor/reconcile-fix-dispatch.mjs'], lane: 9 },
      {
        root: '/repo',
        readBrief: () => REAL_TEMPLATE_STUB,
        mintSessionId: () => '11111111-1111-4111-8111-111111111111',
        spawnAgent: (argv, opts) => { calls.push({ argv, opts }); return ''; },
      },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].opts).toEqual({ cwd: '/repo' });
    expect(calls[0].argv).toEqual([
      '--bg',
      '--session-id', '11111111-1111-4111-8111-111111111111',
      '-n', 'fix-1764',
      '# fix brief for 1764 (item 3438)\n'
      + 'acquire: node scripts/lane-pool.mjs acquire --lane=9 --session=fix-1764 '
      + '--scope=we:scripts/conveyor/reconcile-fix-dispatch.mjs --base=lane/3438-wire-reconcile-pass\n'
      + 'this brief documents {{LIKE_THIS}} as an example convention, not a real token',
    ]);

    expect(result.sessionId).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.sessionSlug).toBe('fix-1764');
    expect(result.pr).toBe(1764);
    expect(result.itemNum).toBe('3438');
    expect(result.lane).toBe(9);
    expect(result.unknownTokens).toEqual(['{{LIKE_THIS}}']);
  });

  it('refuses to dispatch from inside a lane checkout, same guard dispatch-lane-io.mjs uses', () => {
    expect(() => dispatchFix(
      { itemNum: '3438', pr: 1, laneRef: 'lane/3438-x', scope: ['we:x'], lane: 1 },
      { root: '/some/path/.lanes/web-everything/lane-3', readBrief: () => REAL_TEMPLATE_STUB, spawnAgent: () => { throw new Error('must not be called'); } },
    )).toThrow(/lane/i);
  });
});

describe('runReconcileFixDispatch — read reconcile-pass, plan, assign a lane, dispatch', () => {
  const reconcileStub = (dispatchEntries) => () => ({ dispatch: dispatchEntries, refusals: [], notes: [], prs: dispatchEntries.length, agents: 0 });

  it('dispatches every dispatchable fix entry and assigns each its own free lane, in order', () => {
    const entries = [
      { kind: 'fix', prNumber: 1764, headRefName: 'lane/3438-wire-reconcile-pass' },
      { kind: 'fix', prNumber: 1765, headRefName: 'lane/3438-wire-reconcile-pass-b' },
    ];
    const dispatched = [];
    const result = runReconcileFixDispatch({
      root: '/repo',
      reconcile: reconcileStub(entries),
      findItemFn: findItemStub,
      loadItems: () => [],
      pickFreeLanes: () => [2, 9],
      dispatch: (planned) => { dispatched.push(planned); return { sessionId: `s-${planned.pr}`, sessionSlug: `fix-${planned.pr}`, pr: planned.pr, itemNum: planned.itemNum, lane: planned.lane, unknownTokens: [] }; },
      checkStaleness: FRESH,
    });
    expect(dispatched).toEqual([
      { itemNum: '3438', pr: 1764, laneRef: 'lane/3438-wire-reconcile-pass', scope: item3438.scope, lane: 2 },
      { itemNum: '3438', pr: 1765, laneRef: 'lane/3438-wire-reconcile-pass-b', scope: item3438.scope, lane: 9 },
    ]);
    expect(result.dispatched).toHaveLength(2);
    expect(result.refusals).toEqual([]);
  });

  it('refuses `no-lane` for a planned fix once the free lanes run out, rather than dispatching two agents onto one lane', () => {
    const entries = [
      { kind: 'fix', prNumber: 1764, headRefName: 'lane/3438-wire-reconcile-pass' },
      { kind: 'fix', prNumber: 1765, headRefName: 'lane/3438-wire-reconcile-pass-b' },
    ];
    const dispatched = [];
    const result = runReconcileFixDispatch({
      root: '/repo',
      reconcile: reconcileStub(entries),
      findItemFn: findItemStub,
      loadItems: () => [],
      pickFreeLanes: () => [2],
      dispatch: (planned) => { dispatched.push(planned); return { sessionId: 's', sessionSlug: 'fix', pr: planned.pr, itemNum: planned.itemNum, lane: planned.lane, unknownTokens: [] }; },
      checkStaleness: FRESH,
    });
    expect(dispatched).toHaveLength(1);
    expect(result.refusals).toEqual([{ pr: 1765, kind: 'no-lane', why: expect.stringContaining('no free lane') }]);
  });

  it('reports a `dispatch-failed` refusal (never throws the whole pass) when one dispatch throws — e.g. a lost lane race', () => {
    const entries = [{ kind: 'fix', prNumber: 1764, headRefName: 'lane/3438-wire-reconcile-pass' }];
    const result = runReconcileFixDispatch({
      root: '/repo',
      reconcile: reconcileStub(entries),
      findItemFn: findItemStub,
      loadItems: () => [],
      pickFreeLanes: () => [2],
      dispatch: () => { throw new Error('lane-9 lost its race to a sibling'); },
      checkStaleness: FRESH,
    });
    expect(result.dispatched).toEqual([]);
    expect(result.refusals).toEqual([{ pr: 1764, kind: 'dispatch-failed', why: 'lane-9 lost its race to a sibling' }]);
  });

  it('refuses to run at all from a stale checkout (#3439), never reading reconcile-pass\'s plan', () => {
    let reconcileCalls = 0;
    expect(() => runReconcileFixDispatch({
      root: '/repo',
      reconcile: () => { reconcileCalls += 1; return { dispatch: [], refusals: [], notes: [] }; },
      checkStaleness: () => ({ action: 'warn', behind: 3 }),
    })).toThrow(/behind origin\/main/);
    expect(reconcileCalls).toBe(0);
  });
});

describe('fixBriefPath', () => {
  it('points at the SAME brief dispatch-lane.mjs\'s own tick-core-driven fix dispatch fills', () => {
    expect(fixBriefPath('/repo')).toBe('/repo/skills-src/conveyor/fix-agent-brief.md');
  });
});
