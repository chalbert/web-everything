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
import { describe, it, expect } from 'vitest';

import { DISPATCH_EFFECT } from '../dispatch-lane.mjs';
import { briefPath, REPO_ROOT } from '../dispatch-lane-io.mjs';
import { dispatchCiHeal, runReconcileCiHealDispatch } from '../ci-heal-pr-dispatch.mjs';
import { readUnsupported } from '../../conveyor/unsupported-repo.mjs';

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
