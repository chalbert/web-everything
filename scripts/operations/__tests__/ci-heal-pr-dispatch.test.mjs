/**
 * @file ci-heal-pr-dispatch.test.mjs — `dispatchCiHeal` (#3852), the entry that dispatches one ci-heal for a
 * PR carrying `ci:failed`, from land-advance's `dispatch-ci-heal` owed row.
 *
 * NO PROCESS IS STARTED AND NO FILE IS READ. The module takes its brief reader and its effect sinks by
 * injection (`readBrief`, `sinks`), so each test hands it a stub template and a recording sink. The one
 * exception reads the REAL `fix-agent-ci-brief.md` off disk, to prove the tokens the module fills are the
 * tokens that brief actually carries.
 *
 * WHAT IS PINNED HERE, AND WHAT IS NOT. The module hands ONE payload to the sink and passes back what the sink
 * answers; the double-dispatch guard itself (the action-record that keys on the PR) is the SINK's, so the
 * `held` test uses a sink that behaves as that guard does and asserts the module passes it through unchanged.
 */

import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { DISPATCH_EFFECT } from '../dispatch-lane.mjs';
import { briefPath, REPO_ROOT } from '../dispatch-lane-io.mjs';
import { dispatchCiHeal, runReconcileCiHealDispatch } from '../ci-heal-pr-dispatch.mjs';
import { readUnsupported } from '../../conveyor/unsupported-repo.mjs';
import { flushOwedWrites, readOwedWrites, recordOwedWrite, OWED_MAX_AGE_MS } from '../../conveyor/ci-heal-owed.mjs';
import { buildCiHealComment } from '../../conveyor/ci-heal-mark.mjs';

// #4352 — `runReconcileCiHealDispatch` now flushes owed CI-heal writes from the host-shared gh-throttle lock root
// by default. Point that root at a throwaway dir for this whole file so no test ever reads (or posts) a real
// host's owed record.
let savedLockRoot;
let isolatedLockRoot;
beforeAll(() => {
  savedLockRoot = process.env.WE_GH_THROTTLE_LOCK_ROOT;
  isolatedLockRoot = mkdtempSync(join(tmpdir(), 'ci-heal-dispatch-lockroot-'));
  process.env.WE_GH_THROTTLE_LOCK_ROOT = isolatedLockRoot;
});
afterAll(() => {
  if (savedLockRoot === undefined) delete process.env.WE_GH_THROTTLE_LOCK_ROOT;
  else process.env.WE_GH_THROTTLE_LOCK_ROOT = savedLockRoot;
  rmSync(isolatedLockRoot, { recursive: true, force: true });
});

const FRESH = () => ({ fresh: true, behind: 0 });

const TEMPLATE = 'heal #{{ITEM_NUM}} pr={{PR_NUM}} ref={{LANE_REF}} lane={{LANE}} slug={{SESSION_SLUG}} scope={{SCOPE}} why={{REASON}}';

const PLANNED = {
  itemNum: '2638', pr: 743, laneRef: 'lane/2638-some-slug', scope: ['we:scripts/a.mjs', 'we:scripts/b.mjs'], lane: 9,
};

/** A sink that records every payload it is handed and answers like the real one does on a first dispatch. */
const recordingSink = (answer = { handle: 'agent-1' }) => {
  const calls = [];
  return { calls, sinks: { [DISPATCH_EFFECT]: async (payload) => { calls.push(payload); return answer; } } };
};

describe('dispatchCiHeal (#3852)', () => {
  it('fills the brief with the PR, lane, scope, ref and reason tokens', async () => {
    const { calls, sinks } = recordingSink();
    await dispatchCiHeal(PLANNED, { readBrief: () => TEMPLATE, sinks });
    expect(calls).toHaveLength(1);
    const slug = calls[0].sessionSlug;
    expect(calls[0].prompt).toBe(
      `heal #2638 pr=743 ref=lane/2638-some-slug lane=9 slug=${slug} scope=we:scripts/a.mjs,we:scripts/b.mjs why=red-ci`,
    );
  });

  it('hands one ci-heal payload keyed on the PR to the dispatch effect sink', async () => {
    const { calls, sinks } = recordingSink();
    const out = await dispatchCiHeal(PLANNED, { readBrief: () => TEMPLATE, sinks });
    expect(calls[0]).toMatchObject({
      launchKind: 'ci-heal', num: '2638', lane: 9, pr: 743, reason: 'red-ci', repo: 'we',
      scope: ['we:scripts/a.mjs', 'we:scripts/b.mjs'],
    });
    expect(out).toEqual({
      agentId: 'agent-1', sessionSlug: calls[0].sessionSlug, pr: 743, itemNum: '2638', lane: 9, unknownTokens: [],
    });
  });

  it('carries an explicit reason through to the brief and the payload', async () => {
    const { calls, sinks } = recordingSink();
    await dispatchCiHeal({ ...PLANNED, reason: 'behind' }, { readBrief: () => TEMPLATE, sinks });
    expect(calls[0].reason).toBe('behind');
    expect(calls[0].prompt).toMatch(/why=behind$/);
  });

  it('a second call for the same PR comes back held, and dispatches nothing new', async () => {
    // Stands in for the action-record guard the real sink applies, which keys on the PR.
    const seen = new Set();
    const sinks = {
      [DISPATCH_EFFECT]: async (payload) => {
        if (seen.has(payload.pr)) return { held: true, reason: `pr ${payload.pr} already has a ci-heal in flight` };
        seen.add(payload.pr);
        return { handle: 'agent-1' };
      },
    };
    const first = await dispatchCiHeal(PLANNED, { readBrief: () => TEMPLATE, sinks });
    const second = await dispatchCiHeal(PLANNED, { readBrief: () => TEMPLATE, sinks });
    expect(first.agentId).toBe('agent-1');
    expect(second).toEqual({ held: true, reason: 'pr 743 already has a ci-heal in flight' });
  });

  it('never touches a review:* label: the sink is the only call it makes and no payload names one', async () => {
    const { calls, sinks } = recordingSink();
    await dispatchCiHeal(PLANNED, { readBrief: () => TEMPLATE, sinks });
    expect(Object.keys(sinks)).toEqual([DISPATCH_EFFECT]);
    const payload = { ...calls[0] };
    delete payload.prompt; // the brief text itself may say "never touch review:*"; the payload fields must not carry one
    expect(JSON.stringify(payload)).not.toMatch(/review:|label/);
  });

  it('an item-less PR fills ITEM_NUM blank and reports itemNum null', async () => {
    const { calls, sinks } = recordingSink();
    const out = await dispatchCiHeal({ ...PLANNED, itemNum: null }, { readBrief: () => TEMPLATE, sinks });
    expect(calls[0].prompt).toMatch(/^heal # pr=743/);
    expect(calls[0].num).toBeUndefined();
    expect(out.itemNum).toBeNull();
  });

  it('a handle-less sink answer reports agentId null instead of throwing', async () => {
    const { sinks } = recordingSink({});
    const out = await dispatchCiHeal(PLANNED, { readBrief: () => TEMPLATE, sinks });
    expect(out.agentId).toBeNull();
  });

  it('refuses a scope token the brief cannot carry safely, before any sink call', async () => {
    const { calls, sinks } = recordingSink();
    await expect(
      dispatchCiHeal({ ...PLANNED, scope: ['we:scripts/a b.mjs'] }, { readBrief: () => TEMPLATE, sinks }),
    ).rejects.toThrow(/SCOPE|cannot carry safely/);
    expect(calls).toHaveLength(0);
  });

  // #x0mn6x0 (epic #4075/#3383) — live incident 2026-09-25: PRs #2653/#2636/#2635 named no backlog item, and
  // `resolvePrWorkUnit`'s own diff-derived fallback came back empty too (a real `gh` hiccup in the dispatching
  // daemon's own checkout), so `runReconcileCiHealDispatch` handed `dispatchCiHeal` a genuinely empty
  // `planned.scope`. Before this fix `SCOPE` was REQUIRED (not in `fillBrief`'s `optionalNames`), so this threw
  // `dispatch-lane: no value for the brief placeholder {{SCOPE}}` deep inside — never reaching the sink, and
  // (one level up, in `runReconcileCiHealDispatch`'s own per-entry `catch`) surfacing only as an opaque
  // `dispatch-failed` refusal that consumed the lane popped for that entry. A red PR with no resolvable scope
  // must still get SOME ci-heal attempt (an honestly UNFENCED one) rather than never getting one at all.
  it('#x0mn6x0 — an empty scope (no item, nothing derivable from the diff either) fills SCOPE blank instead of throwing', async () => {
    const { calls, sinks } = recordingSink();
    const out = await dispatchCiHeal({ ...PLANNED, scope: [] }, { readBrief: () => TEMPLATE, sinks });
    expect(calls[0].prompt).toBe(`heal #2638 pr=743 ref=lane/2638-some-slug lane=9 slug=${calls[0].sessionSlug} scope= why=red-ci`);
    expect(calls[0].scope).toEqual([]);
    expect(out.agentId).toBe('agent-1');
  });

  it('the real fix-agent-ci-brief.md is fully filled: no required token is left behind', async () => {
    const { calls, sinks } = recordingSink();
    const real = readFileSync(briefPath(REPO_ROOT, 'ci-heal'), 'utf8');
    await dispatchCiHeal(PLANNED, { readBrief: () => real, sinks });
    for (const name of ['ITEM_NUM', 'PR_NUM', 'LANE_REF', 'LANE', 'SESSION_SLUG', 'SCOPE', 'REASON']) {
      expect(calls[0].prompt).not.toContain(`{{${name}}}`);
    }
    expect(calls[0].prompt).toContain('lane/2638-some-slug');
  });

  // #3967 multi-repo slice 7 — BEFORE this slice, `repo` was never threaded into `sessionSlugFor`, so a
  // frontierui/plateau-app heal session minted the SAME bare `ci-heal-<pr>` name a WE one would — the exact
  // bug `reconcile-core.mjs#bindAgents`'s own repo-tagged name-bind (added by this same slice) could never
  // match, meaning a genuinely in-flight sibling-repo heal would have been re-planned every tick.
  // Hermetic: `checkoutExists`/`readPackageJson` injected so this never touches the real filesystem — a CI
  // runner carries no `$HOME/workspace/plateau-app` clone at all (mirrors `reconcile-fix-dispatch.test.mjs`'s
  // own sibling-repo `dispatchFix` tests exactly).
  const PLATEAU_FS = { home: '/home/test', checkoutExists: () => true, readPackageJson: () => JSON.stringify({ scripts: { test: 'vitest run' } }) };

  it('#3967 — a sibling-repo dispatch mints a REPO-TAGGED session slug (`ci-heal-pa-<pr>`), never the bare WE one', async () => {
    const { calls, sinks } = recordingSink();
    const out = await dispatchCiHeal({ ...PLANNED, repo: 'plateau-app' }, { readBrief: () => TEMPLATE, sinks, ...PLATEAU_FS });
    expect(out.sessionSlug).toBe('ci-heal-pa-743');
    expect(calls[0].sessionSlug).toBe('ci-heal-pa-743');
  });

  it('#3967 — same PR number in two different repos mints distinct session slugs — never a WE/plateau-app collision', async () => {
    const we = recordingSink();
    const pa = recordingSink();
    const weOut = await dispatchCiHeal(PLANNED, { readBrief: () => TEMPLATE, sinks: we.sinks });
    const paOut = await dispatchCiHeal({ ...PLANNED, repo: 'plateau-app' }, { readBrief: () => TEMPLATE, sinks: pa.sinks, ...PLATEAU_FS });
    expect(weOut.sessionSlug).toBe('ci-heal-743');
    expect(paOut.sessionSlug).toBe('ci-heal-pa-743');
    expect(weOut.sessionSlug).not.toBe(paOut.sessionSlug);
  });
});

// ── runReconcileCiHealDispatch — THE WHOLE PASS (#3967 multi-repo slice 7) ───────────────────────────────────────
// Mirrors `reconcile-fix-dispatch.test.mjs`'s own `runReconcileFixDispatch — repo capability gate` block: same
// composition (read the reconcile plan → capability-gate → lane → dispatch), same durable `unsupported-repo`
// ledger, one dispatch kind over.
describe('runReconcileCiHealDispatch — repo capability gate (#3967 multi-repo slice 7)', () => {
  it('a repo whose profile has `ciHeal:false` refuses every planned ci-heal `unsupported-repo`, never touching a lane or dispatch sink', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ci-heal-refusals-'));
    const unsupportedPath = join(dir, 'rows.json');
    const calls = [];
    try {
      const options = {
        root: '/repo', repo: 'chalbert/plateau-app', unsupportedPath,
        reconcile: () => ({ dispatch: [{ kind: 'ci-heal', prNumber: 50, headRefName: 'lane/x' }, { kind: 'fix', prNumber: 51 }], refusals: [] }),
        pickFreeLanes: () => { calls.push('pool'); return [2]; },
        dispatch: () => { calls.push('dispatch'); },
        resolveWorkUnit: () => ({ itemNum: null, scope: [] }),
        // Real constellation repos now ALL have `ciHeal:true` (this slice's own point) — inject a profile
        // resolver reporting it off, exercising the branch for whatever repo the constellation grows next.
        resolveProfile: () => ({ capabilities: { fix: true, ciHeal: false }, lanePoolRepo: '/nonexistent' }),
        checkStaleness: FRESH,
      };
      const result = await runReconcileCiHealDispatch(options);
      expect(result.dispatched).toEqual([]);
      expect(result.refusals).toEqual([{ kind: 'unsupported-repo', repo: 'plateau-app', prNumber: 50, action: 'ci-heal', why: expect.any(String) }]);
      expect(calls).toEqual([]); // never touched the lane pool or a dispatch sink — only `fix` was in the plan's non-ci-heal row
      expect(readUnsupported({ path: unsupportedPath })).toHaveLength(1);
      await expect(runReconcileCiHealDispatch({ repo: 'unknown/repo' })).rejects.toThrow(/not a constellation repo/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('preserves a repo\'s already-recorded `fix` unsupported row when it (re)records its own `ci-heal` rows', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ci-heal-preserve-'));
    const unsupportedPath = join(dir, 'rows.json');
    const { recordUnsupported } = await import('../../conveyor/unsupported-repo.mjs');
    try {
      recordUnsupported({ repo: 'plateau-app', rows: [{ action: 'fix', prNumber: 9 }], path: unsupportedPath });
      await runReconcileCiHealDispatch({
        root: '/repo', repo: 'chalbert/plateau-app', unsupportedPath,
        reconcile: () => ({ dispatch: [{ kind: 'ci-heal', prNumber: 50, headRefName: 'lane/x' }], refusals: [] }),
        resolveProfile: () => ({ capabilities: { fix: true, ciHeal: false }, lanePoolRepo: '/nonexistent' }),
        checkStaleness: FRESH,
      });
      const rows = readUnsupported({ path: unsupportedPath });
      expect(rows).toEqual(expect.arrayContaining([
        expect.objectContaining({ action: 'fix', prNumber: 9 }),
        expect.objectContaining({ action: 'ci-heal', prNumber: 50 }),
      ]));
      // Now flip the SAME repo's capability on — its `ci-heal` row clears, the `fix` row survives untouched.
      await runReconcileCiHealDispatch({
        root: '/repo', repo: 'chalbert/plateau-app', unsupportedPath,
        reconcile: () => ({ dispatch: [], refusals: [] }),
        resolveProfile: () => ({ capabilities: { fix: true, ciHeal: true }, lanePoolRepo: '/nonexistent' }),
        pickFreeLanes: () => [],
        checkStaleness: FRESH,
      });
      expect(readUnsupported({ path: unsupportedPath })).toEqual([expect.objectContaining({ action: 'fix', prNumber: 9 })]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  // ── THE PROOF (operator rule: "make sure the agent that fix bugs actually test it so we know it works") ──────
  // A REAL dry-run against BOTH plateau-app and frontierui's REAL profile (`resolveProfile` NOT injected — this
  // is `repo-profile.mjs`'s own `repoProfile`, which this slice flipped `ciHeal` to `true` for both), with an
  // injected no-op `dispatch` and a synthetic red-CI reconcile reading. Before this slice, EITHER repo hit the
  // wholesale `unsupported-repo` refusal every time; after it, the SAME entry is planned and dispatched.
  for (const [slug, key, tag] of [['chalbert/plateau-app', 'plateau-app', 'pa'], ['chalbert/frontierui', 'frontierui', 'fui']]) {
    it(`#3967 — REAL profile, ${key}: a red-CI PR is dispatched \`ci-heal\` into ${key}'s OWN lane pool, never refused unsupported-repo`, async () => {
      const dispatchCalls = [];
      const result = await runReconcileCiHealDispatch({
        root: '/repo', repo: slug,
        reconcile: () => ({
          dispatch: [{ kind: 'ci-heal', prNumber: 202, headRefName: 'lane/some-branch', attempts: 0 }],
          refusals: [],
        }),
        resolveWorkUnit: () => ({ itemNum: null, scope: [`${tag === 'pa' ? 'plateau' : 'fui'}:src/x.ts`] }),
        pickFreeLanes: () => [7],
        dispatch: async (planned, opts) => {
          dispatchCalls.push({ planned, opts });
          return { agentId: null, sessionSlug: `ci-heal-${tag}-${planned.pr}`, pr: planned.pr, itemNum: planned.itemNum, lane: planned.lane, unknownTokens: [] };
        },
        checkStaleness: FRESH,
      });
      // PLANNED, not refused unsupported-repo: this is the exact assertion the refusal-gate test above proves
      // the OPPOSITE of when `ciHeal` is off.
      expect(result.refusals).toEqual([]);
      expect(dispatchCalls).toEqual([{
        planned: expect.objectContaining({ pr: 202, lane: 7, reason: 'red-ci' }),
        opts: expect.objectContaining({ repo: key }),
      }]);
      expect(result.dispatched).toEqual([{
        agentId: null, sessionSlug: `ci-heal-${tag}-202`, pr: 202, itemNum: null, lane: 7, unknownTokens: [],
      }]);
    });
  }

  it('a `held` dispatch answer is reported as a `held` refusal, not thrown or silently dropped', async () => {
    const result = await runReconcileCiHealDispatch({
      root: '/repo', repo: 'chalbert/plateau-app',
      reconcile: () => ({ dispatch: [{ kind: 'ci-heal', prNumber: 50, headRefName: 'lane/x' }], refusals: [] }),
      resolveWorkUnit: () => ({ itemNum: null, scope: [] }),
      pickFreeLanes: () => [3],
      dispatch: async () => ({ held: true, reason: 'pr 50 already has a ci-heal in flight' }),
      checkStaleness: FRESH,
    });
    expect(result.dispatched).toEqual([]);
    expect(result.refusals).toEqual([{ pr: 50, kind: 'held', why: 'pr 50 already has a ci-heal in flight' }]);
  });

  it('a thrown dispatch is caught per-entry as `dispatch-failed`, never aborting the whole pass', async () => {
    const result = await runReconcileCiHealDispatch({
      root: '/repo', repo: 'chalbert/plateau-app',
      reconcile: () => ({
        dispatch: [
          { kind: 'ci-heal', prNumber: 50, headRefName: 'lane/x' },
          { kind: 'ci-heal', prNumber: 51, headRefName: 'lane/y' },
        ],
        refusals: [],
      }),
      resolveWorkUnit: () => ({ itemNum: null, scope: [] }),
      pickFreeLanes: () => [3, 4],
      dispatch: async (planned) => {
        if (planned.pr === 50) throw new Error('spawn failed');
        return { agentId: 'agent-1', sessionSlug: `ci-heal-pa-${planned.pr}`, pr: planned.pr, itemNum: null, lane: planned.lane, unknownTokens: [] };
      },
      checkStaleness: FRESH,
    });
    expect(result.refusals).toEqual([{ pr: 50, kind: 'dispatch-failed', why: 'spawn failed' }]);
    expect(result.dispatched).toEqual([{ agentId: 'agent-1', sessionSlug: 'ci-heal-pa-51', pr: 51, itemNum: null, lane: 4, unknownTokens: [] }]);
  });

  it('no free lane refuses `no-lane` for the entries beyond the pool, never a partial dispatch attempt', async () => {
    const dispatchCalls = [];
    const result = await runReconcileCiHealDispatch({
      root: '/repo', repo: 'chalbert/plateau-app',
      reconcile: () => ({
        dispatch: [{ kind: 'ci-heal', prNumber: 50, headRefName: 'lane/x' }],
        refusals: [],
      }),
      resolveWorkUnit: () => ({ itemNum: null, scope: [] }),
      pickFreeLanes: () => [],
      dispatch: async (planned) => { dispatchCalls.push(planned); return {}; },
      checkStaleness: FRESH,
    });
    expect(dispatchCalls).toEqual([]);
    expect(result.refusals).toEqual([{ pr: 50, kind: 'no-lane', why: expect.stringContaining('PR #50') }]);
  });

  // #x0mn6x0 (epic #4075/#3383) — LIVE INCIDENT 2026-09-25: `reconcile-core.mjs#planReconcile`'s own outright
  // refusals (a PR never even offered as a `kind:'ci-heal'` dispatch entry — e.g. PR #2635's `owed-ci-rerun`)
  // used to be collapsed to `reconcileRefusals:<count>` here and nowhere else ever saw the reasons.
  // `reconcileRefusalDetails` is the SAME `reconciled.refusals` array, handed up unchanged and additively (the
  // pre-existing `reconcileRefusals` count stays exactly as it was — asserted below too).
  it('reconcileRefusalDetails carries the real reconcile-layer refusal objects, additively alongside the existing count', async () => {
    const result = await runReconcileCiHealDispatch({
      root: '/repo', repo: 'chalbert/plateau-app',
      reconcile: () => ({
        dispatch: [],
        refusals: [{ prNumber: 2635, kind: 'owed-ci-rerun', why: "main's own CI was red" }],
      }),
      checkStaleness: FRESH,
    });
    expect(result.reconcileRefusals).toBe(1);
    expect(result.reconcileRefusalDetails).toEqual([{ prNumber: 2635, kind: 'owed-ci-rerun', why: "main's own CI was red" }]);
  });
});

// ── #4352 — the per-tick OWED-WRITE FLUSH ────────────────────────────────────────────────────────────────────────
// A fake `gh` stands in for GitHub: it serves `pr view` from a mutable PR record and appends every `pr comment`
// to that record's own thread, so "posted exactly once" is read off the same comment list a real PR would show.
describe('#4352 — runReconcileCiHealDispatch flushes owed CI-heal writes first, idempotently', () => {
  const HEAD = '1234567890abcdef1234567890abcdef12345678';
  const AUTOMATION = { login: 'web-everything' };
  const fakeGh = (prs, { failPosts = false } = {}) => {
    const calls = [];
    const exec = (cmd, args) => {
      calls.push(args.slice(0, 2).join(' '));
      const pr = prs[Number(args[2])];
      if (args[0] === 'pr' && args[1] === 'view') return JSON.stringify({ state: pr.state, comments: pr.comments });
      if (args[0] === 'pr' && args[1] === 'comment') {
        if (failPosts) throw Object.assign(new Error('rate limit exceeded'), { stderr: 'API rate limit exceeded' });
        pr.comments.push({ body: args[args.indexOf('--body') + 1], author: AUTOMATION });
        return '';
      }
      throw new Error(`unexpected gh ${args.join(' ')}`);
    };
    return { calls, exec };
  };
  const owe = (dir, pr, extra = {}, now = Date.now()) => recordOwedWrite({
    repo: 'we', slug: 'chalbert/web-everything', pr, kind: 'ci-heal', headSha: HEAD,
    body: buildCiHealComment({ reason: 'red-ci', headSha: HEAD }), ...extra,
  }, { dir, now });
  const run = (dir, exec, order = [], now = Date.now()) => runReconcileCiHealDispatch({
    root: '/repo', repo: 'chalbert/web-everything', checkStaleness: FRESH,
    flushOwed: (key) => { order.push('flush'); return flushOwedWrites({ repo: key, dir, exec, now }); },
    reconcile: () => { order.push('reconcile'); return { dispatch: [], refusals: [] }; },
    dispatch: async () => { order.push('dispatch'); return {}; },
    pickFreeLanes: () => [],
    unsupportedPath: join(dir, 'unsupported.json'),
  });

  it('posts an owed comment in-process BEFORE the reconcile read, clears it, and a second tick posts nothing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'owed-flush-'));
    try {
      const prs = { 2821: { state: 'OPEN', comments: [] } };
      const { calls, exec } = fakeGh(prs);
      owe(dir, 2821);
      const order = [];
      const first = await run(dir, exec, order);
      expect(order).toEqual(['flush', 'reconcile']); // flush first; never a dispatched agent
      expect(first.owedFlush.posted).toEqual([expect.objectContaining({ pr: 2821, kind: 'ci-heal', headSha: HEAD })]);
      expect(prs[2821].comments).toHaveLength(1);
      expect(readOwedWrites({ dir })).toEqual([]);
      // Re-owe the SAME write (e.g. a client-side failure that actually landed) — the head-scoped marker catches it.
      owe(dir, 2821);
      const second = await run(dir, exec);
      expect(second.owedFlush.cleared).toEqual([expect.objectContaining({ pr: 2821 })]);
      expect(prs[2821].comments).toHaveLength(1); // exactly one CI-heal comment, ever
      expect(calls.filter((c) => c === 'pr comment')).toHaveLength(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('an OLDER heal\'s marker for a different head does not satisfy the owed write — it is still posted', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'owed-flush-'));
    try {
      const older = buildCiHealComment({ reason: 'red-ci', headSha: 'f'.repeat(40) });
      const prs = { 7: { state: 'OPEN', comments: [{ body: older, author: AUTOMATION }] } };
      const { exec } = fakeGh(prs);
      owe(dir, 7);
      const out = await run(dir, exec);
      expect(out.owedFlush.posted).toHaveLength(1);
      expect(prs[7].comments).toHaveLength(2);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('a merged or closed PR\'s owed write is dropped as moot, never posted', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'owed-flush-'));
    try {
      const prs = { 8: { state: 'MERGED', comments: [] }, 9: { state: 'CLOSED', comments: [] } };
      const { calls, exec } = fakeGh(prs);
      owe(dir, 8); owe(dir, 9);
      const out = await run(dir, exec);
      expect(out.owedFlush.dropped.map((d) => d.pr).sort()).toEqual([8, 9]);
      expect(calls).not.toContain('pr comment');
      expect(readOwedWrites({ dir })).toEqual([]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('a still-refused post is kept (attempts bumped); a record past its bound is dropped, not retried forever', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'owed-flush-'));
    try {
      const prs = { 10: { state: 'OPEN', comments: [] }, 11: { state: 'OPEN', comments: [] } };
      const { calls, exec } = fakeGh(prs, { failPosts: true });
      const now = Date.now();
      owe(dir, 10, {}, now);
      owe(dir, 11, {}, now - OWED_MAX_AGE_MS - 1);
      const out = await run(dir, exec, [], now);
      expect(out.owedFlush.kept).toEqual([expect.objectContaining({ pr: 10 })]);
      expect(out.owedFlush.dropped).toEqual([expect.objectContaining({ pr: 11, why: 'expired' })]);
      expect(readOwedWrites({ dir })).toEqual([expect.objectContaining({ pr: 10, attempts: 1 })]);
      expect(calls.filter((c) => c === 'pr comment')).toHaveLength(1); // the expired one never even tried
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('only flushes the tick\'s OWN repo — another repo\'s owed record is left for that repo\'s tick', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'owed-flush-'));
    try {
      const { calls, exec } = fakeGh({});
      recordOwedWrite({ repo: 'plateau-app', slug: 'chalbert/plateau-app', pr: 3, kind: 'ci-heal', headSha: HEAD, body: 'x' }, { dir });
      const out = await run(dir, exec);
      expect(calls).toEqual([]);
      expect(out.owedFlush).toEqual({ posted: [], cleared: [], dropped: [], kept: [] });
      expect(readOwedWrites({ dir })).toHaveLength(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

it('xxh4zw8 replay soak reaches one exact-head heal sink, holds subsequent ticks, and never promotes unknown evidence', async () => {
  const { runReconcilePass } = await import('../../conveyor/reconcile-pass.mjs');
  const { runReconcilePromoteDraftDispatch } = await import('../promote-draft-pr-dispatch.mjs');
  const sha = '4ecb5deb362c81aa28de162db4616bb4c2009347';
  const required = ['test', 'smoke', 'daemon-soak', 'soak-replay-gate'];
  const rows = required.map((name, i) => ({ id: 110460009383 + i, name, status: 'completed',
    conclusion: name === 'smoke' ? 'cancelled' : 'success', completed_at: '2026-10-01T10:00:00Z' }));
  const pr = { number: 3336, headRefOid: sha, headRefName: 'lane/3336-replay', isDraft: true, labels: [], comments: [],
    statusCheckRollup: Array.from({ length: 100 }, (_, i) => ({ name: i ? 'review-gate' : 'soak-replay-gate', status: 'COMPLETED', conclusion: 'SUCCESS' })) };
  const claims = [], plannedCalls = [], readyCalls = [];
  const { calls, sinks } = recordingSink();
  const dir = mkdtempSync(join(tmpdir(), 'xxh4zw8-dispatch-'));
  let held = false;
  const reconcile = readChecks => runReconcilePass({ repo: 'we', readPrs: () => [pr], readChecks,
    readRequiredChecks: () => ({ checks: required }), readAgents: () => [], enrich: a => a,
    enrichMainRed: prs => ({ prs, mainRedWindows: [] }), enrichAlreadyLanded: prs => prs,
    enrichBaseRef: prs => prs, enrichSystemFix: prs => prs, enrichFixClaims: prs => prs, resolveMainSha: () => null });
  try {
    for (let tick = 0; tick < 25; tick++) {
      const plan = reconcile(() => rows);
      expect(plan.dispatch.map(d => d.kind)).toEqual(['ci-heal']);
      const result = await runReconcileCiHealDispatch({ root: '/repo', repo: 'we', reconcile: () => plan,
        unsupportedPath: join(dir, 'unsupported.json'), flushOwed: () => ({}), checkStaleness: FRESH,
        pickFreeLanes: () => [7], resolveWorkUnit: () => ({ itemNum: null, scope: [] }),
        dispatch: (planned, opts) => {
          plannedCalls.push(planned);
          return dispatchCiHeal(planned, { ...opts, readBrief: () => TEMPLATE, sinks, readFixClaim: () => null,
            routeHeal: () => null, acquireClaim: claim => {
              claims.push(claim);
              if (held) return { ok: false, reason: 'already-held' };
              held = true;
              return { ok: true };
            }, releaseClaim: () => { held = false; } });
        } });
      expect(result.dispatched).toHaveLength(tick ? 0 : 1);
      if (tick) expect(result.refusals[0].kind).toBe('held');
      runReconcilePromoteDraftDispatch({ root: '/repo', reconcile: () => plan, checkStaleness: FRESH,
        provider: { ready: n => readyCalls.push(n) }, readHeadCheckState: () => { throw new Error('no promotion owed'); } });
    }
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ pr: 3336, launchKind: 'ci-heal', lane: 7 });
    expect(plannedCalls[0]).toMatchObject({ pr: 3336, headRefOid: sha });
    expect(claims[0]).toMatchObject({ repo: 'we', pr: 3336, headSha: sha });
    const unreadable = reconcile(() => { throw new Error('unreadable checks'); });
    expect(unreadable.dispatch).toEqual([]);
    runReconcilePromoteDraftDispatch({ root: '/repo', reconcile: () => unreadable, checkStaleness: FRESH,
      provider: { ready: n => readyCalls.push(n) } });
    expect(readyCalls).toEqual([]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
