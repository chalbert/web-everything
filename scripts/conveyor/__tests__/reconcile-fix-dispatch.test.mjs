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
  findResumeCandidate, buildResumePrompt, tryResumeFix,
} from '../reconcile-fix-dispatch.mjs';
import { CONFLICT_LABEL } from '../parked-pr-conflict-watch.mjs';
import { DISPATCHED_AGENT_SYSTEM_PROMPT_FILE } from '../../operations/dispatch-lane-io.mjs';
import { buildAuthorActorMarker } from '../../lib/review-independence.mjs';

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
    expect(planned).toEqual([{
      itemNum: '3438', pr: 1764, laneRef: 'lane/3438-wire-reconcile-pass', scope: item3438.scope,
      isConflict: false, body: null, headRefOid: null,
    }]);
  });

  it('#xu2krte — a `fix` entry still carrying the conflict-watch label plans `isConflict: true` and threads `body`/`headRefOid`', () => {
    const entries = [{
      kind: 'fix', prNumber: 1764, headRefName: 'lane/3438-wire-reconcile-pass',
      labels: [CONFLICT_LABEL, 'review:pending'], body: 'a PR body', headRefOid: 'deadbeef'.repeat(5),
    }];
    const { planned } = planFixesFromReconcile(entries, findItemStub, () => []);
    expect(planned).toEqual([{
      itemNum: '3438', pr: 1764, laneRef: 'lane/3438-wire-reconcile-pass', scope: item3438.scope,
      isConflict: true, body: 'a PR body', headRefOid: 'deadbeef'.repeat(5),
    }]);
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
      // #3331 — no `--session-id`: `claude --bg` discards it and assigns its own id.
      '--bg',
      '-n', 'fix-1764',
      // #3606 — the standing-identity system prompt, without which a correctly-filled brief reads as an
      // unfilled template and the agent self-aborts (live 3/3: fix-2127/fix-2130/fix-2003).
      '--append-system-prompt-file', DISPATCHED_AGENT_SYSTEM_PROMPT_FILE,
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
    expect(result.resumed).toBe(false);
  });

  it('attaches a carried-forward `resumeAttempt` (from a prior tryResumeFix call) to the reported result, without re-attempting anything itself', () => {
    const result = dispatchFix(
      { itemNum: '3438', pr: 1764, laneRef: 'lane/3438-wire-reconcile-pass', scope: ['we:x'], lane: 9 },
      {
        root: '/repo', readBrief: () => REAL_TEMPLATE_STUB, mintSessionId: () => 'sid', spawnAgent: () => '',
        resumeAttempt: { attempted: true, candidate: 'cand', forked: true },
      },
    );
    expect(result.resumeAttempt).toEqual({ attempted: true, candidate: 'cand', forked: true });
    expect(result.resumed).toBe(false);
  });

  it('refuses to dispatch from inside a lane checkout, same guard dispatch-lane-io.mjs uses', () => {
    expect(() => dispatchFix(
      { itemNum: '3438', pr: 1, laneRef: 'lane/3438-x', scope: ['we:x'], lane: 1 },
      { root: '/some/path/.lanes/web-everything/lane-3', readBrief: () => REAL_TEMPLATE_STUB, spawnAgent: () => { throw new Error('must not be called'); } },
    )).toThrow(/lane/i);
  });
});

describe('tryResumeFix — #xu2krte Fork 1, and #xazl9u3\'s whole reason to exist: this runs with NO lane involved at all', () => {
  it('a non-conflict planned entry never consults `claude agents` at all, and reports `resumed: false`/no attempt', () => {
    let listAgentsAllCalls = 0;
    const result = tryResumeFix(
      { itemNum: '3438', pr: 1764, laneRef: 'lane/3438-wire-reconcile-pass', scope: ['we:x'], isConflict: false, body: null },
      { root: '/repo', listAgentsAll: () => { listAgentsAllCalls += 1; return []; } },
    );
    expect(listAgentsAllCalls).toBe(0);
    expect(result).toEqual({ resumed: false, resumeAttempt: null });
  });

  it('a conflict entry with no resume candidate at all reports `resumed: false`/no attempt (straight to a fresh dispatch, per the ratified default)', () => {
    const result = tryResumeFix(
      { itemNum: '3438', pr: 1764, laneRef: 'lane/3438-wire-reconcile-pass', scope: ['we:x'], isConflict: true, body: 'no stamp here', headRefOid: null },
      { root: '/repo', listAgentsAll: () => [] },
    );
    expect(result).toEqual({ resumed: false, resumeAttempt: null });
  });

  const MATCHING_HEAD = 'deadbeef'.repeat(5);

  it('#xu2krte Fork 1 — a conflict-caused entry with a listed, OWNERSHIP-CONFIRMED resume candidate attempts a bare resume first, and returns `resumed: true` with NO lane on success', () => {
    const marker = buildAuthorActorMarker('cand-0000-0000-0000-000000000000');
    const spawnCalls = [];
    const result = tryResumeFix(
      {
        itemNum: '3438', pr: 1764, laneRef: 'lane/3438-wire-reconcile-pass', scope: ['we:x'],
        isConflict: true, body: `some PR body\n\n${marker}\n`, headRefOid: MATCHING_HEAD,
      },
      {
        root: '/repo',
        spawnAgent: (argv) => { spawnCalls.push(argv); return 'backgrounded · candxxxx\n'; },
        listAgentsAll: () => [{ sessionId: 'cand-0000-0000-0000-000000000000', id: 'candxxxx', cwd: '/lanes/lane-4', name: 'conveyor-3438' }],
        resolveHead: (cwd) => (cwd === '/lanes/lane-4' ? MATCHING_HEAD : null),
      },
    );
    expect(spawnCalls).toHaveLength(1);
    expect(spawnCalls[0]).toEqual(['--bg', '--resume', 'cand-0000-0000-0000-000000000000', expect.stringContaining('PR #1764')]);
    expect(result).toEqual({
      resumed: true,
      result: {
        sessionId: 'cand-0000-0000-0000-000000000000', sessionSlug: null, pr: 1764, itemNum: '3438', lane: null,
        unknownTokens: [], resumed: true,
      },
    });
  });

  it('#xu2krte security hardening — a candidate whose checkout HEAD does NOT match the PR is refused, never resumed', () => {
    const marker = buildAuthorActorMarker('cand-0000-0000-0000-000000000000');
    const spawnCalls = [];
    const result = tryResumeFix(
      {
        itemNum: '3438', pr: 1764, laneRef: 'lane/3438-wire-reconcile-pass', scope: ['we:x'],
        isConflict: true, body: `some PR body\n\n${marker}\n`, headRefOid: MATCHING_HEAD,
      },
      {
        root: '/repo',
        spawnAgent: (argv) => { spawnCalls.push(argv); return 'backgrounded · x\n'; },
        // The candidate IS listed under the stamped id, but its checkout sits on a DIFFERENT commit — an
        // editable PR-body stamp alone is not enough to trust it (the security finding from PR #1966's review).
        listAgentsAll: () => [{ sessionId: 'cand-0000-0000-0000-000000000000', id: 'candxxxx', cwd: '/lanes/lane-4', name: 'conveyor-3438' }],
        resolveHead: () => 'a-totally-different-sha',
      },
    );
    // No resume attempt was ever made — no spawn call at all.
    expect(spawnCalls).toHaveLength(0);
    expect(result.resumed).toBe(false);
    expect(result.resumeAttempt).toEqual({
      attempted: false, candidate: 'cand-0000-0000-0000-000000000000', forked: false,
      refused: 'ownership-unconfirmed', why: expect.stringContaining('head match: false'),
    });
  });

  it('#xu2krte security hardening — a candidate with the RIGHT head but a name that could not legitimately be this pr\'s builder is also refused', () => {
    const marker = buildAuthorActorMarker('cand-0000-0000-0000-000000000000');
    const spawnCalls = [];
    const result = tryResumeFix(
      {
        itemNum: '3438', pr: 1764, laneRef: 'lane/3438-wire-reconcile-pass', scope: ['we:x'],
        isConflict: true, body: `some PR body\n\n${marker}\n`, headRefOid: MATCHING_HEAD,
      },
      {
        root: '/repo',
        spawnAgent: (argv) => { spawnCalls.push(argv); return 'backgrounded · x\n'; },
        // Same HEAD as the pr (a coincidence PR #1966's review named explicitly: two lanes CAN share a commit),
        // but a name that is neither `conveyor-3438` nor `fix-1764` — an unrelated session, not this pr's own.
        listAgentsAll: () => [{ sessionId: 'cand-0000-0000-0000-000000000000', id: 'candxxxx', cwd: '/lanes/lane-4', name: 'conveyor-9999' }],
        resolveHead: () => MATCHING_HEAD,
      },
    );
    expect(spawnCalls).toHaveLength(0);
    expect(result.resumeAttempt).toEqual({
      attempted: false, candidate: 'cand-0000-0000-0000-000000000000', forked: false,
      refused: 'ownership-unconfirmed', why: expect.stringContaining('name match: false'),
    });
  });

  it('#xu2krte Fork 1 — a fork (mismatched id) is stopped and reports `resumed: false`/`attempted: true`, leaving the fresh dispatch to the caller', () => {
    const marker = buildAuthorActorMarker('cand-0000-0000-0000-000000000000');
    const spawnCalls = [];
    const stopCalls = [];
    let listCall = 0;
    const result = tryResumeFix(
      {
        itemNum: '3438', pr: 1764, laneRef: 'lane/3438-wire-reconcile-pass', scope: ['we:x'],
        isConflict: true, body: `some PR body\n\n${marker}\n`, headRefOid: MATCHING_HEAD,
      },
      {
        root: '/repo',
        spawnAgent: (argv) => { spawnCalls.push(argv); return 'backgrounded · forkedid\n'; },
        // Row 1 (before the resume attempt): the candidate is listed, so a resume is attempted.
        // Every read AFTER: only a DIFFERENT id ("forkedid") is listed — the CLI forked a copy. The retry
        // loop (hardening 2) reads this same wrong answer every time, so it correctly exhausts, not stalls.
        listAgentsAll: () => {
          listCall += 1;
          return listCall === 1
            ? [{ sessionId: 'cand-0000-0000-0000-000000000000', id: 'candxxxx', cwd: '/lanes/lane-4', name: 'conveyor-3438' }]
            : [{ sessionId: 'a-different-session-id', id: 'forkedid', cwd: '/lanes/lane-9' }];
        },
        resolveHead: (cwd) => (cwd === '/lanes/lane-4' ? MATCHING_HEAD : null),
        stop: ({ handle }) => stopCalls.push(handle),
        wait: () => {}, // no real sleeping in a unit test
      },
    );
    expect(stopCalls).toEqual(['forkedid']);
    // Only the one resume-attempt spawn — this function never performs the fresh dispatch itself.
    expect(spawnCalls).toHaveLength(1);
    expect(result.resumed).toBe(false);
    expect(result.resumeAttempt).toEqual({ attempted: true, candidate: 'cand-0000-0000-0000-000000000000', forked: true });
  });

  it('#xu2krte hardening (2) — a listing that lags by ONE read still resolves as a genuine resume, not a fork', () => {
    const marker = buildAuthorActorMarker('cand-0000-0000-0000-000000000000');
    let listCall = 0;
    let waitCalls = 0;
    const result = tryResumeFix(
      {
        itemNum: '3438', pr: 1764, laneRef: 'lane/3438-wire-reconcile-pass', scope: ['we:x'],
        isConflict: true, body: `some PR body\n\n${marker}\n`, headRefOid: MATCHING_HEAD,
      },
      {
        root: '/repo',
        spawnAgent: () => 'backgrounded · candxxxx\n',
        // Call 1: the pre-spawn candidate lookup. Call 2 (the FIRST post-spawn confirm read): the listing has
        // not caught up yet — no row at all, simulating exactly the propagation lag #3331 documents. Call 3
        // onward: caught up.
        listAgentsAll: () => {
          listCall += 1;
          if (listCall === 2) return [];
          return [{ sessionId: 'cand-0000-0000-0000-000000000000', id: 'candxxxx', cwd: '/lanes/lane-4', name: 'conveyor-3438' }];
        },
        resolveHead: () => MATCHING_HEAD,
        wait: () => { waitCalls += 1; },
      },
    );
    expect(result.resumed).toBe(true);
    expect(waitCalls).toBe(1); // exactly one retry was needed
  });

  it('#3541 — a post-resume row MISSING `id` entirely resolves `resumed:false` (the safe direction) and the anomaly rides onto `resumeAttempt`', () => {
    // Two positive fallbacks for this exact shape were tried and rejected by independent review (see
    // `resumeSucceeded`'s own docblock) — the landed behavior is the pre-#3541 one: an id-match failure means
    // `stop(printedId)` and a fresh dispatch (which the caller performs), never a claimed resume. What's new is
    // visibility: the never-yet-observed missing-`id` shape now names itself on `resumeAttempt.anomaly` instead
    // of being silently indistinguishable from an ordinary fork.
    const marker = buildAuthorActorMarker('cand-0000-0000-0000-000000000000');
    const stopCalls = [];
    const result = tryResumeFix(
      {
        itemNum: '3438', pr: 1764, laneRef: 'lane/3438-wire-reconcile-pass', scope: ['we:x'],
        isConflict: true, body: `some PR body\n\n${marker}\n`, headRefOid: MATCHING_HEAD,
      },
      {
        root: '/repo',
        spawnAgent: () => 'backgrounded · candxxxx\n',
        // Call 1 (the pre-resume ownership check): the candidate is listed with its `id`, as always. Every
        // call AFTER: the SAME session, still listed by `sessionId` — but this time its `id` is gone, the
        // exact `#x3gdu12` scenario this item was filed to worry about.
        listAgentsAll: () => [{
          sessionId: 'cand-0000-0000-0000-000000000000', cwd: '/lanes/lane-4', name: 'conveyor-3438', kind: 'background',
        }],
        resolveHead: () => MATCHING_HEAD,
        stop: ({ handle }) => stopCalls.push(handle),
        wait: () => {},
      },
    );
    expect(result.resumed).toBe(false);
    expect(stopCalls).toEqual(['candxxxx']);
    expect(result.resumeAttempt).toEqual({
      attempted: true, candidate: 'cand-0000-0000-0000-000000000000', forked: true,
      anomaly: 'requested-session-listed-without-id',
    });
  });

  it('#3541 — a fork whose row has NOT propagated into the listing at all is still safely read as not-resumed, no anomaly reported (it is an ordinary fork, not the missing-`id` shape)', () => {
    // Rounds 1-2 of this item's own build tried to read this shape as a confirmed resume from
    // absence-of-a-new-session, and both were found unsafe by independent review — a live measurement showed
    // listing propagation lag of 26+ seconds, far past any retry budget this call site can afford. The landed
    // function does not attempt it at all: this shape (candidate still listed, its own row DOES carry `id`,
    // nothing new visible yet) resolves via the id-match branch failing to find `forkedid`, exactly like any
    // other unmatched id.
    const marker = buildAuthorActorMarker('cand-0000-0000-0000-000000000000');
    const stopCalls = [];
    const result = tryResumeFix(
      {
        itemNum: '3438', pr: 1764, laneRef: 'lane/3438-wire-reconcile-pass', scope: ['we:x'],
        isConflict: true, body: `some PR body\n\n${marker}\n`, headRefOid: MATCHING_HEAD,
      },
      {
        root: '/repo',
        // The CLI actually forked a copy under `forkedid`, but that fork's row never shows up within this
        // dispatch's retry budget — every read looks identical (candidate still listed, id present, nothing new).
        spawnAgent: () => 'backgrounded · forkedid\n',
        listAgentsAll: () => [{
          sessionId: 'cand-0000-0000-0000-000000000000', cwd: '/lanes/lane-4', name: 'conveyor-3438', id: 'candxxxx', kind: 'background',
        }],
        resolveHead: (cwd) => (cwd === '/lanes/lane-4' ? MATCHING_HEAD : null),
        stop: ({ handle }) => stopCalls.push(handle),
        wait: () => {},
      },
    );
    expect(result.resumed).toBe(false);
    expect(stopCalls).toEqual(['forkedid']);
    expect(result.resumeAttempt).toEqual({ attempted: true, candidate: 'cand-0000-0000-0000-000000000000', forked: true });
  });

  it('refuses to run from inside a lane checkout, same guard dispatch-lane-io.mjs uses — even for a conflict entry', () => {
    expect(() => tryResumeFix(
      { itemNum: '3438', pr: 1, laneRef: 'lane/3438-x', scope: ['we:x'], isConflict: true, body: null },
      { root: '/some/path/.lanes/web-everything/lane-3', spawnAgent: () => { throw new Error('must not be called'); } },
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
      { itemNum: '3438', pr: 1764, laneRef: 'lane/3438-wire-reconcile-pass', scope: item3438.scope, isConflict: false, body: null, headRefOid: null, lane: 2 },
      { itemNum: '3438', pr: 1765, laneRef: 'lane/3438-wire-reconcile-pass-b', scope: item3438.scope, isConflict: false, body: null, headRefOid: null, lane: 9 },
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

  it('PR #1972 review finding — a THROWING `tryResume` is isolated to a per-entry `dispatch-failed` refusal, and does not abort the rest of the tick', () => {
    const entries = [
      // Entry 1: conflict-caused; its `tryResume` call throws (e.g. a transient `claude agents --json` read).
      { kind: 'fix', prNumber: 1764, headRefName: 'lane/3438-wire-reconcile-pass', labels: [CONFLICT_LABEL], body: 'stamped', headRefOid: 'sha' },
      // Entry 2: an unrelated ordinary bounce that must still be processed in the SAME tick.
      { kind: 'fix', prNumber: 1765, headRefName: 'lane/3438-wire-reconcile-pass-b' },
    ];
    const dispatchCalls = [];
    const result = runReconcileFixDispatch({
      root: '/repo',
      reconcile: reconcileStub(entries),
      findItemFn: findItemStub,
      loadItems: () => [],
      pickFreeLanes: () => [2],
      tryResume: (entry) => {
        if (entry.pr === 1764) throw new Error('claude agents --json --all: transient listing failure');
        return { resumed: false, resumeAttempt: null };
      },
      dispatch: (planned) => { dispatchCalls.push(planned.pr); return { sessionId: `s-${planned.pr}`, sessionSlug: `fix-${planned.pr}`, pr: planned.pr, itemNum: planned.itemNum, lane: planned.lane, unknownTokens: [], resumed: false }; },
      checkStaleness: FRESH,
    });
    // Entry 1 is refused individually; entry 2 still dispatches — the whole pass did NOT abort.
    expect(dispatchCalls).toEqual([1765]);
    expect(result.dispatched).toEqual([
      { sessionId: 's-1765', sessionSlug: 'fix-1765', pr: 1765, itemNum: '3438', lane: 2, unknownTokens: [], resumed: false },
    ]);
    expect(result.refusals).toEqual([
      { pr: 1764, kind: 'dispatch-failed', why: 'claude agents --json --all: transient listing failure' },
    ]);
  });

  it('#xazl9u3 — a conflict entry whose resume attempt SUCCEEDS never touches the lane pool at all: the free lane it never needed is still there for the very next entry', () => {
    const entries = [
      // Entry 1: conflict-caused, and (per the injected `tryResume` stub below) resumes successfully.
      { kind: 'fix', prNumber: 1764, headRefName: 'lane/3438-wire-reconcile-pass', labels: [CONFLICT_LABEL], body: 'stamped', headRefOid: 'sha' },
      // Entry 2: an ordinary bounce that DOES need a lane.
      { kind: 'fix', prNumber: 1765, headRefName: 'lane/3438-wire-reconcile-pass-b' },
    ];
    const tryResumeCalls = [];
    const dispatchCalls = [];
    // Only ONE free lane in the whole pool. If entry 1's successful resume consumed it, entry 2 would starve
    // with a `no-lane` refusal — the exact waste #xazl9u3 was filed against.
    const result = runReconcileFixDispatch({
      root: '/repo',
      reconcile: reconcileStub(entries),
      findItemFn: findItemStub,
      loadItems: () => [],
      pickFreeLanes: () => [7],
      tryResume: (entry) => {
        tryResumeCalls.push(entry.pr);
        if (entry.pr === 1764) {
          return { resumed: true, result: { sessionId: 'cand', sessionSlug: null, pr: 1764, itemNum: '3438', lane: null, unknownTokens: [], resumed: true } };
        }
        return { resumed: false, resumeAttempt: null };
      },
      dispatch: (planned) => { dispatchCalls.push(planned); return { sessionId: `s-${planned.pr}`, sessionSlug: `fix-${planned.pr}`, pr: planned.pr, itemNum: planned.itemNum, lane: planned.lane, unknownTokens: [], resumed: false }; },
      checkStaleness: FRESH,
    });

    // tryResume was consulted for the conflict entry only (entry 2 carries no CONFLICT_LABEL, so isConflict is
    // false and the loop never even calls tryResume for it).
    expect(tryResumeCalls).toEqual([1764]);
    // The resumed entry never reached `dispatch` at all, and the ONE free lane went to entry 2 — proof the
    // pool was left untouched by the resume.
    expect(dispatchCalls).toEqual([
      expect.objectContaining({ pr: 1765, lane: 7 }),
    ]);
    expect(result.dispatched).toEqual([
      { sessionId: 'cand', sessionSlug: null, pr: 1764, itemNum: '3438', lane: null, unknownTokens: [], resumed: true },
      { sessionId: 's-1765', sessionSlug: 'fix-1765', pr: 1765, itemNum: '3438', lane: 7, unknownTokens: [], resumed: false },
    ]);
    expect(result.refusals).toEqual([]); // no `no-lane` refusal — the pool never actually ran dry
  });

  it('#xazl9u3 — a conflict entry whose resume attempt is REFUSED/forked still falls through to a real lane-consuming dispatch, carrying the resumeAttempt along for reporting', () => {
    const entries = [{ kind: 'fix', prNumber: 1764, headRefName: 'lane/3438-wire-reconcile-pass', labels: [CONFLICT_LABEL], body: 'stamped', headRefOid: 'sha' }];
    const dispatchCalls = [];
    const result = runReconcileFixDispatch({
      root: '/repo',
      reconcile: reconcileStub(entries),
      findItemFn: findItemStub,
      loadItems: () => [],
      pickFreeLanes: () => [7],
      tryResume: () => ({ resumed: false, resumeAttempt: { attempted: true, candidate: 'cand', forked: true } }),
      dispatch: (planned, opts) => { dispatchCalls.push({ planned, resumeAttempt: opts.resumeAttempt }); return { sessionId: 's', sessionSlug: 'fix', pr: planned.pr, itemNum: planned.itemNum, lane: planned.lane, unknownTokens: [], resumed: false }; },
      checkStaleness: FRESH,
    });
    expect(dispatchCalls).toEqual([{
      planned: expect.objectContaining({ pr: 1764, lane: 7 }),
      resumeAttempt: { attempted: true, candidate: 'cand', forked: true },
    }]);
    expect(result.dispatched).toHaveLength(1);
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

describe('findResumeCandidate — #xu2krte Fork 1', () => {
  it('returns the stamped session id when it is still listed', () => {
    const marker = buildAuthorActorMarker('11111111-1111-4111-8111-111111111111');
    const id = findResumeCandidate({
      body: `some body\n\n${marker}\n`,
      agentsAll: [{ sessionId: '11111111-1111-4111-8111-111111111111' }],
    });
    expect(id).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('returns null when the body carries no stamp at all', () => {
    expect(findResumeCandidate({ body: 'no stamp here', agentsAll: [{ sessionId: 'x' }] })).toBeNull();
  });

  it('returns null when the stamped session is no longer listed (fully exited and reaped)', () => {
    const marker = buildAuthorActorMarker('11111111-1111-4111-8111-111111111111');
    const id = findResumeCandidate({ body: marker, agentsAll: [{ sessionId: 'some-other-session' }] });
    expect(id).toBeNull();
  });

  it('returns null on a conflicting (ambiguous) stamp — agreement-or-nothing, never a guess', () => {
    const two = `${buildAuthorActorMarker('aaaa')}\n${buildAuthorActorMarker('bbbb')}`;
    expect(findResumeCandidate({ body: two, agentsAll: [{ sessionId: 'aaaa' }, { sessionId: 'bbbb' }] })).toBeNull();
  });
});

describe('buildResumePrompt — #xu2krte Fork 1', () => {
  it('names the PR, the item, and the escalation stand-down command — never a literal undefined', () => {
    const prompt = buildResumePrompt({ pr: 1764, itemNum: '3438', cwd: '/lanes/lane-4' });
    expect(prompt).toContain('PR #1764');
    expect(prompt).toContain('item #3438');
    expect(prompt).toContain('/lanes/lane-4');
    expect(prompt).toContain('stand-down.mjs 1764 --reason=conflict');
    expect(prompt).not.toContain('undefined');
    expect(prompt.trimStart().startsWith('-')).toBe(false);
  });

  it('still renders sensibly with no known cwd', () => {
    const prompt = buildResumePrompt({ pr: 1, itemNum: '1' });
    expect(prompt).not.toContain('undefined');
    expect(prompt).not.toContain('null');
  });
});

// ── #3331 — a fresh fix dispatch reports the id `claude --bg` assigned, not the minted one ────────────────────

describe('#3331 — dispatchFix reads its handle back off stdout', () => {
  /** Verbatim the first line CLI 2.1.269 prints on stdout for a `--bg` spawn. */
  const BANNER = (id) => `backgrounded · ${id} · fix-1764\n  claude agents             list sessions\n`;

  const dispatch = (spawnAgent) => dispatchFix(
    { itemNum: '3438', pr: 1764, laneRef: 'lane/3438-wire-reconcile-pass', scope: ['we:scripts/conveyor/reconcile-fix-dispatch.mjs'], lane: 9 },
    {
      root: '/repo',
      readBrief: () => '# fix brief for {{PR_NUM}} (item {{ITEM_NUM}})\n'
        + 'acquire: node scripts/lane-pool.mjs acquire --lane={{LANE}} --session={{SESSION_SLUG}} '
        + '--scope={{SCOPE}} --base={{LANE_REF}}',
      mintSessionId: () => '11111111-1111-4111-8111-111111111111',
      spawnAgent,
    },
  );

  it('returns `agentId` from the banner — the minted uuid addresses no session', () => {
    // Same defect, same blast radius as the review side: `buildAgentArgv` used to pass `--session-id` and
    // `claude --bg` used to ignore it, so the id this pass printed could never be found by `claude
    // agents`/`logs`/`stop`, and `stampLiveness` read every fix dispatch as gone.
    const result = dispatch(() => BANNER('9356543a'));
    expect(result.agentId).toBe('9356543a');
    expect(result.sessionId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('and `agentId: null` when the banner cannot be read, rather than a handle that will not be found', () => {
    expect(dispatch(() => '').agentId).toBeNull();
  });
});

// ── #3606 — the fix agent must be TOLD its brief is real, or it self-aborts ───────────────────────────────────

describe('#3606 — dispatchFix always passes the dispatched-agent system prompt', () => {
  it('emits --append-system-prompt-file, ahead of any extraArgs and the prompt', () => {
    // THE DEFECT THIS PINS, live-confirmed 3/3 on 2026-09-11. `fix-agent-brief.md` opens with "**This is a
    // TEMPLATE, not a runnable skill.**" and keeps `{{PLACEHOLDERS}}`/`{{LIKE_THIS}}` in its own explanatory
    // prose (legitimately unsubstituted — `fillBrief` reports them as non-fatal unknown tokens by design), so a
    // CORRECTLY filled brief still reads as an unfilled template. `fix-2127`, `fix-2130` and `fix-2003` each
    // received a fully substituted 16.5 KB brief naming their real PR and each replied "I don't see an actual
    // task or question in your message — just the fix-agent brief template (#2630) itself", doing no work.
    //
    // This was the ONE dispatch path missing the remedy: `createDispatchSinks` has always passed this file, and
    // `review-dispatch.mjs` passes its review-side twin (#xy8di3v), but this function passed nothing.
    const calls = [];
    dispatchFix(
      { itemNum: '3438', pr: 1764, laneRef: 'lane/3438-x', scope: ['we:scripts/conveyor/reconcile-fix-dispatch.mjs'], lane: 9 },
      {
        root: '/repo',
        readBrief: () => '# fix brief for {{PR_NUM}} (item {{ITEM_NUM}}) lane {{LANE}} {{SESSION_SLUG}} {{SCOPE}} {{LANE_REF}}',
        mintSessionId: () => '11111111-1111-4111-8111-111111111111',
        spawnAgent: (argv) => { calls.push(argv); return ''; },
        extraArgs: ['--model', 'sonnet'],
      },
    );
    const argv = calls[0];
    const at = argv.indexOf('--append-system-prompt-file');
    expect(at).toBeGreaterThan(-1);
    expect(argv[at + 1]).toBe(DISPATCHED_AGENT_SYSTEM_PROMPT_FILE);
    // Order matters the same way it does for every other dispatch: identity, then operator flags, then prompt.
    expect(at).toBeLessThan(argv.indexOf('--model'));
    expect(argv[argv.length - 1]).toContain('fix brief for 1764');
  });
});
