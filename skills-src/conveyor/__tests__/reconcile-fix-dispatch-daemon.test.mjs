/**
 * @file skills-src/conveyor/__tests__/reconcile-fix-dispatch-daemon.test.mjs
 * @description Unit proof of #3870's standalone Fix-dispatch daemon — the pure loop only (no real lease, no
 *   real dispatch, no real timers): injected effects, so the tick/backoff/stop-condition decision is tested
 *   with fakes exactly like runner.mjs's own `runLoop` is.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  runDaemonLoop, buildCliDaemonEffects, realSleep, RECONCILE_FIX_DISPATCH_LEASE_KEY, DEFAULT_INTERVAL_MS,
  runReconcileFixDispatchAllRepos, FIX_DISPATCH_DAEMON_REPOS, hasStaleMainRefusal,
  runReconcileCiHealDispatchAllRepos, runTickAllRepos, formatRefusalLine,
} from '../reconcile-fix-dispatch-daemon.mjs';
import { CONSTELLATION_REPOS } from '../../../scripts/lib/constellation-repos.mjs';
import { assertMainNotStale } from '../../../scripts/lib/main-staleness.mjs';

// #3383 bug 1 — wired into withSelfSync's `hasStaleRefusal` option in main(); tested here in isolation
// (pure, no IO) against the exact shape `runReconcileFixDispatchAllRepos` returns.
describe('hasStaleMainRefusal', () => {
  it('true when a repo tick-failed with the real assertMainNotStale refusal message', () => {
    let message = null;
    try { assertMainNotStale('/repo', () => ({ action: 'warn', reason: 'diverged', behind: 1, ahead: 5, dirty: false })); }
    catch (e) { message = e.message; }
    expect(hasStaleMainRefusal({ refusals: [{ repo: 'chalbert/frontierui', kind: 'tick-failed', why: message }] })).toBe(true);
  });
  it('false for an ordinary, unrelated tick failure', () => {
    expect(hasStaleMainRefusal({ refusals: [{ repo: 'x', kind: 'tick-failed', why: 'gh: rate limited' }] })).toBe(false);
  });
  it('false for a non-tick-failed refusal (an ordinary per-PR dispatch refusal is not a whole-repo tick failure)', () => {
    expect(hasStaleMainRefusal({ refusals: [{ repo: 'x', kind: 'no-scope', why: 'STALE code from this checkout — false shape, not tick-failed' }] })).toBe(false);
  });
  it('false with no refusals, or a missing/malformed result', () => {
    expect(hasStaleMainRefusal({ refusals: [] })).toBe(false);
    expect(hasStaleMainRefusal({})).toBe(false);
    expect(hasStaleMainRefusal(undefined)).toBe(false);
  });
});

describe('runDaemonLoop — the pure control flow', () => {
  it('requires a tickOnce effect', async () => {
    await expect(runDaemonLoop({})).rejects.toThrow(/requires a tickOnce effect/);
  });

  it('ticks, sleeps between ticks, and stops at maxTicks', async () => {
    const sleep = vi.fn(async () => {});
    const tickOnce = vi.fn(async () => ({ dispatched: [], refusals: [] }));
    const out = await runDaemonLoop({ tickOnce, sleep, maxTicks: 3 });
    expect(tickOnce).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2); // never sleeps after the LAST tick
    expect(out).toEqual({ ticks: 3, stoppedReason: 'max-ticks' });
  });

  it('a failing tick is isolated — reported via onTickError, never fatal, the loop continues', async () => {
    const onTickError = vi.fn();
    let calls = 0;
    const tickOnce = vi.fn(async () => { calls += 1; if (calls === 1) throw new Error('transient gh hiccup'); return { ok: true }; });
    const out = await runDaemonLoop({ tickOnce, sleep: async () => {}, onTickError, maxTicks: 2 });
    expect(tickOnce).toHaveBeenCalledTimes(2);
    expect(onTickError).toHaveBeenCalledTimes(1);
    expect(onTickError.mock.calls[0][0].message).toBe('transient gh hiccup');
    expect(out).toEqual({ ticks: 2, stoppedReason: 'max-ticks' });
  });

  it('a lost heartbeat stops the loop immediately — never sleeps or ticks again after losing the lease', async () => {
    let heartbeats = 0;
    const heartbeat = vi.fn(async () => { heartbeats += 1; return heartbeats < 2; }); // alive tick 1, lost tick 2
    const sleep = vi.fn(async () => {});
    const tickOnce = vi.fn(async () => ({}));
    const out = await runDaemonLoop({ tickOnce, sleep, heartbeat, maxTicks: Infinity });
    expect(tickOnce).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1); // slept after tick 1 (still alive), never after tick 2 (lease lost)
    expect(out).toEqual({ ticks: 2, stoppedReason: 'lease-lost' });
  });

  it('onTick observes every successful result, in order', async () => {
    const seen = [];
    const results = [{ dispatched: [1] }, { dispatched: [2] }];
    let i = 0;
    const tickOnce = async () => results[i++];
    await runDaemonLoop({ tickOnce, sleep: async () => {}, onTick: (r, tick) => seen.push([tick, r]), maxTicks: 2 });
    expect(seen).toEqual([[0, results[0]], [1, results[1]]]);
  });
});

describe('FIX_DISPATCH_DAEMON_REPOS', () => {
  it('is every constellation repo\'s real slug, not just WE (#x1rr9rh, multi-repo slice 2)', () => {
    expect(FIX_DISPATCH_DAEMON_REPOS.sort()).toEqual(Object.values(CONSTELLATION_REPOS).map((r) => r.slug).sort());
    expect(FIX_DISPATCH_DAEMON_REPOS).toContain('chalbert/plateau-app');
    expect(FIX_DISPATCH_DAEMON_REPOS).toContain('chalbert/frontierui');
    expect(FIX_DISPATCH_DAEMON_REPOS).toContain('chalbert/web-everything');
  });
});

describe('runReconcileFixDispatchAllRepos — one runReconcileFixDispatch call per watched repo (#x1rr9rh)', () => {
  it('ticks every repo in the list, calling runReconcileFixDispatch with {repo: slug} per repo', () => {
    const tick = vi.fn(({ repo }) => (repo === 'repo-a'
      ? { dispatched: [{ pr: 10 }], refusals: [] }
      : { dispatched: [], refusals: [{ kind: 'unsupported-repo', prNumber: 20 }] }));
    const out = runReconcileFixDispatchAllRepos({ repos: ['repo-a', 'repo-b'], tick });
    expect(tick).toHaveBeenCalledTimes(2);
    expect(tick).toHaveBeenCalledWith({ repo: 'repo-a' });
    expect(tick).toHaveBeenCalledWith({ repo: 'repo-b' });
    expect(out.dispatched).toEqual([{ pr: 10, repo: 'repo-a' }]);
    expect(out.refusals).toEqual([{ kind: 'unsupported-repo', prNumber: 20, repo: 'repo-b' }]);
    expect(out.repos).toEqual([
      { repo: 'repo-a', result: expect.any(Object) },
      { repo: 'repo-b', result: expect.any(Object) },
    ]);
  });

  it('one repo throwing (a gh outage, a stale-checkout refusal) never stops the others — isolated per repo', () => {
    const tick = vi.fn(({ repo }) => {
      if (repo === 'repo-bad') throw new Error('reconcile-fix-dispatch: behind origin/main');
      return { dispatched: [{ pr: 1 }], refusals: [] };
    });
    const out = runReconcileFixDispatchAllRepos({ repos: ['repo-bad', 'repo-good'], tick });
    expect(out.dispatched).toEqual([{ pr: 1, repo: 'repo-good' }]);
    expect(out.refusals).toEqual([{ repo: 'repo-bad', prNumber: null, kind: 'tick-failed', why: 'reconcile-fix-dispatch: behind origin/main' }]);
    expect(out.repos[0]).toEqual({ repo: 'repo-bad', error: 'reconcile-fix-dispatch: behind origin/main' });
  });

  it('defaults to FIX_DISPATCH_DAEMON_REPOS and to the real runReconcileFixDispatch when nothing is injected', () => {
    // Only proves the DEFAULTS are wired — this test injects `tick` itself so the real
    // runReconcileFixDispatch's own IO defaults (gh, lane-pool, git) are never reached.
    const tick = vi.fn(() => ({ dispatched: [], refusals: [] }));
    const out = runReconcileFixDispatchAllRepos({ tick });
    expect(tick).toHaveBeenCalledTimes(FIX_DISPATCH_DAEMON_REPOS.length);
    expect(out.repos.map((r) => r.repo)).toEqual(FIX_DISPATCH_DAEMON_REPOS);
  });

  // #x0mn6x0 (epic #4075/#3383) — a PR `reconcile-core.mjs#planReconcile` refuses OUTRIGHT (never becoming a
  // `kind:'fix'` dispatch entry at all) previously vanished: `runReconcileFixDispatch` collapsed
  // `reconciled.refusals` to a bare `reconcileRefusals:number` and nothing upstream ever saw the reasons. Proves
  // the per-repo `reconcileRefusalDetails` array is now tagged with `repo` and threaded into this fan-out's own
  // `reconcileRefusals` aggregate, exactly like `dispatched`/`refusals` already are.
  it('threads each repo\'s own reconcileRefusalDetails into a repo-tagged reconcileRefusals aggregate', () => {
    const tick = vi.fn(({ repo }) => (repo === 'repo-a'
      ? { dispatched: [], refusals: [], reconcileRefusalDetails: [{ prNumber: 2635, kind: 'owed-ci-rerun', why: 'main was red' }] }
      : { dispatched: [], refusals: [], reconcileRefusalDetails: [] }));
    const out = runReconcileFixDispatchAllRepos({ repos: ['repo-a', 'repo-b'], tick });
    expect(out.reconcileRefusals).toEqual([
      { repo: 'repo-a', prNumber: 2635, kind: 'owed-ci-rerun', why: 'main was red' },
    ]);
  });

  it('reconcileRefusals is an empty array (never undefined) when a repo result carries no reconcileRefusalDetails at all', () => {
    const tick = vi.fn(() => ({ dispatched: [], refusals: [] })); // no reconcileRefusalDetails key
    const out = runReconcileFixDispatchAllRepos({ repos: ['repo-a'], tick });
    expect(out.reconcileRefusals).toEqual([]);
  });
});

describe('buildCliDaemonEffects — the real-effect factory (heartbeat wiring only; no real dispatch/timer)', () => {
  it('uses its own distinct lease key, never the Dispatcher default sentinel', () => {
    expect(RECONCILE_FIX_DISPATCH_LEASE_KEY).toBe('<conveyor:reconcile-fix-dispatch-daemon-lease>');
  });

  it('defaults the interval to DEFAULT_INTERVAL_MS, matching runner.mjs\'s own tick cadence', () => {
    const effects = buildCliDaemonEffects({ owner: 'x' });
    expect(effects.intervalMs).toBe(DEFAULT_INTERVAL_MS);
    expect(DEFAULT_INTERVAL_MS).toBe(120_000);
  });

  it('exposes the shape runDaemonLoop needs', () => {
    const effects = buildCliDaemonEffects({ owner: 'x' });
    expect(typeof effects.tickOnce).toBe('function');
    expect(typeof effects.sleep).toBe('function');
    expect(typeof effects.heartbeat).toBe('function');
    expect(typeof effects.onTick).toBe('function');
    expect(typeof effects.onTickError).toBe('function');
  });

  it('onTick logs per-repo dispatched/refused counts, mirroring review-daemon\'s own tick log shape (#x1rr9rh)', () => {
    const log = { error: vi.fn() };
    const effects = buildCliDaemonEffects({ owner: 'x', log });
    effects.onTick({
      repos: [{ repo: 'chalbert/web-everything', result: {} }, { repo: 'chalbert/plateau-app', error: 'gh: rate limited' }],
      dispatched: [{ pr: 1, repo: 'chalbert/web-everything' }],
      refusals: [{ kind: 'unsupported-repo', prNumber: 2, repo: 'chalbert/plateau-app' }],
    });
    expect(log.error).toHaveBeenCalledWith(
      'reconcile-fix-dispatch-daemon: tick (chalbert/web-everything, chalbert/plateau-app) — dispatched 1, refused 1',
    );
    expect(log.error).toHaveBeenCalledWith(
      'reconcile-fix-dispatch-daemon: chalbert/plateau-app tick failed (non-fatal, other repos unaffected): gh: rate limited',
    );
  });

  // #x0mn6x0 (epic #4075/#3383) — LIVE INCIDENT 2026-09-25: PRs #2635/#2636/#2653 sat `ci:failed` for a full
  // day with the daemon logging only "dispatched 0, refused N" — no way to tell WHY without a live overlay
  // probe. This is the fix: one printed line per refusal, both the dispatch-layer ones (`refusals`) and the
  // reconcile-layer ones that used to be silently collapsed to a count (`reconcileRefusals`).
  it('onTick prints ONE LINE PER REFUSAL (kind, repo, PR, why) — never just the summary count', () => {
    const log = { error: vi.fn() };
    const effects = buildCliDaemonEffects({ owner: 'x', log });
    effects.onTick({
      repos: [{ repo: 'chalbert/web-everything', result: {} }],
      dispatched: [],
      refusals: [{ kind: 'no-lane', pr: 2636, repo: 'chalbert/web-everything', why: 'no free lane to dispatch a CI-heal agent for PR #2636' }],
      reconcileRefusals: [],
    });
    expect(log.error).toHaveBeenCalledWith(
      'reconcile-fix-dispatch-daemon: refused no-lane chalbert/web-everything PR #2636 — no free lane to dispatch a CI-heal agent for PR #2636',
    );
  });

  it('onTick ALSO prints the reconcile-layer refusals (owed-ci-rerun etc.) — previously a bare count, now the real reason', () => {
    const log = { error: vi.fn() };
    const effects = buildCliDaemonEffects({ owner: 'x', log });
    effects.onTick({
      repos: [{ repo: 'chalbert/web-everything', result: {} }],
      dispatched: [],
      refusals: [],
      reconcileRefusals: [{
        kind: 'owed-ci-rerun', prNumber: 2635, repo: 'chalbert/web-everything',
        why: "the required check failed at 2026-09-25T01:57:47Z, while main's own CI was red",
      }],
    });
    expect(log.error).toHaveBeenCalledWith(
      "reconcile-fix-dispatch-daemon: reconcile-refused owed-ci-rerun chalbert/web-everything PR #2635 — the required check failed at 2026-09-25T01:57:47Z, while main's own CI was red",
    );
  });

  it('onTick never double-prints a tick-failed refusal — the per-repo loop already covers it', () => {
    const log = { error: vi.fn() };
    const effects = buildCliDaemonEffects({ owner: 'x', log });
    effects.onTick({
      repos: [{ repo: 'chalbert/frontierui', error: 'gh: rate limited' }],
      dispatched: [],
      refusals: [{ repo: 'chalbert/frontierui', prNumber: null, kind: 'tick-failed', why: 'gh: rate limited' }],
      reconcileRefusals: [],
    });
    const calls = log.error.mock.calls.map((c) => c[0]);
    expect(calls.filter((line) => line.includes('gh: rate limited'))).toHaveLength(1);
  });

  it('onTick tolerates a tick result with no reconcileRefusals key at all (older/injected callers)', () => {
    const log = { error: vi.fn() };
    const effects = buildCliDaemonEffects({ owner: 'x', log });
    expect(() => effects.onTick({ repos: [], dispatched: [], refusals: [] })).not.toThrow();
  });
});

// #x0mn6x0 (epic #4075/#3383) — the shared per-refusal-line formatter `onTick` uses for BOTH populations.
describe('formatRefusalLine — one printable line per refusal, whatever layer produced it', () => {
  it('reads pr OR prNumber (the two field names actually used across the fix/ci-heal/reconcile layers)', () => {
    expect(formatRefusalLine('refused', { kind: 'no-lane', pr: 5, repo: 'we', why: 'no free lane' }))
      .toBe('reconcile-fix-dispatch-daemon: refused no-lane we PR #5 — no free lane');
    expect(formatRefusalLine('refused', { kind: 'held', prNumber: 6, repo: 'we', why: 'already in flight' }))
      .toBe('reconcile-fix-dispatch-daemon: refused held we PR #6 — already in flight');
  });

  it('falls back to readable placeholders for a refusal missing a PR number or a reason', () => {
    expect(formatRefusalLine('reconcile-refused', { kind: 'stood-down', repo: 'we' }))
      .toBe('reconcile-fix-dispatch-daemon: reconcile-refused stood-down we (no PR) — (no reason given)');
  });
});

describe('realSleep — regression, live-caught 2026-09-22', () => {
  // The daemon's FIRST real run (launchd-managed, real gh/claude calls) exited right after tick 1 instead of
  // looping: `.unref()`-ing this timer told Node it was fine to exit before it fired, and nothing else in the
  // process keeps the event loop alive between ticks (the spawned agent's stdio is `ignore`d — no other ref'd
  // handle exists). A unit test that only checked `realSleep`'s PROMISE resolved (as this file's earlier tests
  // effectively did, via fakes) could never catch this — the bug is specifically about whether the underlying
  // Node `Timeout` object is ref'd, which only a real, unmocked `setTimeout` reveals.
  it('realSleep\'s own timer is REF\'d — a resident daemon must not let Node exit before it fires', () => {
    const real = global.setTimeout;
    let captured;
    global.setTimeout = (fn, ms) => { captured = real(fn, ms); return captured; };
    try {
      realSleep(60_000); // never awaited — only the timer's own ref state is asserted, then cleared
      expect(captured.hasRef()).toBe(true); // FAILS if realSleep re-adds `.unref()`
    } finally {
      clearTimeout(captured);
      global.setTimeout = real;
    }
  });

  it('realSleep resolves after the real delay and leaves no unref\'d timer behind (smoke test, short delay)', async () => {
    const start = Date.now();
    await realSleep(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15); // loose bound — real timers, not fake ones
  });
});

// #xngv3vn (epic #3383/#4075) — LIVE incident: an adversarial review found `we:scripts/operations
// /ci-heal-pr-dispatch.mjs#runReconcileCiHealDispatch` had NO CALLER in any running daemon, so a PR that fell
// `ci:failed` and was owed a `ci-heal` dispatch by `runReconcilePass`'s own plan just sat there — nothing ever
// ran it. `runReconcileCiHealDispatchAllRepos` is the per-repo fan-out (this daemon's `fix` half already has
// one, `runReconcileFixDispatchAllRepos`); `runTickAllRepos` is what actually reaches the daemon's tick.
describe('runReconcileCiHealDispatchAllRepos — one runReconcileCiHealDispatch call per watched repo, SEQUENTIALLY awaited (#xngv3vn)', () => {
  it('ticks every repo in the list, awaiting each async call, and merges dispatched/refusals with repo attached', async () => {
    const calls = [];
    const tick = vi.fn(async ({ repo }) => {
      calls.push(repo);
      return repo === 'repo-a'
        ? { dispatched: [{ pr: 10 }], refusals: [] }
        : { dispatched: [], refusals: [{ kind: 'unsupported-repo', prNumber: 20 }] };
    });
    const out = await runReconcileCiHealDispatchAllRepos({ repos: ['repo-a', 'repo-b'], tick });
    expect(tick).toHaveBeenCalledTimes(2);
    expect(tick).toHaveBeenCalledWith({ repo: 'repo-a' });
    expect(tick).toHaveBeenCalledWith({ repo: 'repo-b' });
    expect(calls).toEqual(['repo-a', 'repo-b']); // sequential, not raced
    expect(out.dispatched).toEqual([{ pr: 10, repo: 'repo-a' }]);
    expect(out.refusals).toEqual([{ kind: 'unsupported-repo', prNumber: 20, repo: 'repo-b' }]);
  });

  it('one repo\'s rejected promise (a gh outage, a stale-checkout refusal) never stops the others — isolated per repo', async () => {
    const tick = vi.fn(async ({ repo }) => {
      if (repo === 'repo-bad') throw new Error('ci-heal-pr-dispatch: behind origin/main');
      return { dispatched: [{ pr: 1 }], refusals: [] };
    });
    const out = await runReconcileCiHealDispatchAllRepos({ repos: ['repo-bad', 'repo-good'], tick });
    expect(out.dispatched).toEqual([{ pr: 1, repo: 'repo-good' }]);
    expect(out.refusals).toEqual([{ repo: 'repo-bad', prNumber: null, kind: 'tick-failed', why: 'ci-heal-pr-dispatch: behind origin/main' }]);
    expect(out.repos[0]).toEqual({ repo: 'repo-bad', error: 'ci-heal-pr-dispatch: behind origin/main' });
  });

  it('defaults to FIX_DISPATCH_DAEMON_REPOS and to the real runReconcileCiHealDispatch when nothing is injected', async () => {
    const tick = vi.fn(async () => ({ dispatched: [], refusals: [] }));
    const out = await runReconcileCiHealDispatchAllRepos({ tick });
    expect(tick).toHaveBeenCalledTimes(FIX_DISPATCH_DAEMON_REPOS.length);
    expect(out.repos.map((r) => r.repo)).toEqual(FIX_DISPATCH_DAEMON_REPOS);
  });

  // #x0mn6x0 (epic #4075/#3383) — mirrors the fix-side proof above for the ci-heal half.
  it('threads each repo\'s own reconcileRefusalDetails into a repo-tagged reconcileRefusals aggregate', async () => {
    const tick = vi.fn(async ({ repo }) => (repo === 'repo-a'
      ? { dispatched: [], refusals: [], reconcileRefusalDetails: [{ prNumber: 2653, kind: 'nothing-owed', why: 'already queued' }] }
      : { dispatched: [], refusals: [], reconcileRefusalDetails: [] }));
    const out = await runReconcileCiHealDispatchAllRepos({ repos: ['repo-a', 'repo-b'], tick });
    expect(out.reconcileRefusals).toEqual([
      { repo: 'repo-a', prNumber: 2653, kind: 'nothing-owed', why: 'already queued' },
    ]);
  });
});

describe('runTickAllRepos — the daemon tick now runs BOTH fix and ci-heal dispatch, merged (#xngv3vn)', () => {
  it('awaits the async ci-heal half and merges both halves\' dispatched/refusals into one result', async () => {
    const fixTick = vi.fn(({ repo }) => ({ dispatched: repo === 'repo-a' ? [{ pr: 1 }] : [], refusals: [] }));
    const ciHealTick = vi.fn(async ({ repo }) => ({ dispatched: repo === 'repo-b' ? [{ pr: 2 }] : [], refusals: [] }));
    const out = await runTickAllRepos({ repos: ['repo-a', 'repo-b'], fixTick, ciHealTick });
    expect(fixTick).toHaveBeenCalledTimes(2);
    expect(ciHealTick).toHaveBeenCalledTimes(2);
    expect(out.dispatched).toEqual([{ pr: 1, repo: 'repo-a' }, { pr: 2, repo: 'repo-b' }]);
    expect(out.refusals).toEqual([]);
    expect(out.repos.map((r) => r.repo)).toEqual(['repo-a', 'repo-b']);
    expect(out.ciHeal.dispatched).toEqual([{ pr: 2, repo: 'repo-b' }]); // the ci-heal half's own detail survives the merge
  });

  it('a fix-side failure for one repo does not skip that SAME repo\'s ci-heal attempt, and vice versa', async () => {
    const fixTick = vi.fn(({ repo }) => { if (repo === 'repo-a') throw new Error('fix broke'); return { dispatched: [], refusals: [] }; });
    const ciHealTick = vi.fn(async ({ repo }) => {
      if (repo === 'repo-b') throw new Error('ci-heal broke');
      return { dispatched: [{ pr: 9, repo }], refusals: [] };
    });
    const out = await runTickAllRepos({ repos: ['repo-a', 'repo-b'], fixTick, ciHealTick });
    expect(ciHealTick).toHaveBeenCalledWith({ repo: 'repo-a' }); // ci-heal still ran for repo-a despite fix's own failure there
    expect(fixTick).toHaveBeenCalledWith({ repo: 'repo-b' }); // fix still ran for repo-b despite ci-heal's own failure there
    expect(out.refusals).toEqual(expect.arrayContaining([
      { repo: 'repo-a', prNumber: null, kind: 'tick-failed', why: 'fix broke' },
      { repo: 'repo-b', prNumber: null, kind: 'tick-failed', why: 'ci-heal broke' },
    ]));
    // repo-a's ci-heal succeeded (dispatched a fix's own {pr:9, repo:'repo-a'}) even though repo-a's fix failed.
    expect(out.dispatched).toEqual(expect.arrayContaining([{ pr: 9, repo: 'repo-a' }]));
  });

  // #x0mn6x0 (epic #4075/#3383) — proves runTickAllRepos merges BOTH halves' own reconcileRefusals arrays,
  // exactly as it already merges dispatched/refusals.
  it('merges both halves\' own reconcileRefusals arrays into one', async () => {
    const fixTick = vi.fn(({ repo }) => ({
      dispatched: [], refusals: [],
      reconcileRefusalDetails: repo === 'repo-a' ? [{ prNumber: 1, kind: 'owed-ci-rerun', why: 'fix-side' }] : [],
    }));
    const ciHealTick = vi.fn(async ({ repo }) => ({
      dispatched: [], refusals: [],
      reconcileRefusalDetails: repo === 'repo-b' ? [{ prNumber: 2, kind: 'nothing-owed', why: 'ci-heal-side' }] : [],
    }));
    const out = await runTickAllRepos({ repos: ['repo-a', 'repo-b'], fixTick, ciHealTick });
    expect(out.reconcileRefusals).toEqual([
      { repo: 'repo-a', prNumber: 1, kind: 'owed-ci-rerun', why: 'fix-side' },
      { repo: 'repo-b', prNumber: 2, kind: 'nothing-owed', why: 'ci-heal-side' },
    ]);
  });

  it('a ci-heal-side stale-main refusal is visible to hasStaleMainRefusal exactly like a fix-side one', async () => {
    let message = null;
    try { assertMainNotStale('/repo', () => ({ action: 'warn', reason: 'diverged', behind: 1, ahead: 5, dirty: false })); }
    catch (e) { message = e.message; }
    const fixTick = vi.fn(() => ({ dispatched: [], refusals: [] }));
    // The ci-heal half throws the REAL `assertMainNotStale` refusal — `ci-heal-pr-dispatch.mjs#runReconcileCiHealDispatch`
    // calls that same guard near its own top, exactly as `runReconcileFixDispatch` already does.
    const ciHealTick = vi.fn(async () => { throw new Error(message); });
    const out = await runTickAllRepos({ repos: ['chalbert/web-everything'], fixTick, ciHealTick });
    // Proves the WIRING: hasStaleMainRefusal reads whatever `runTickAllRepos` puts in `.refusals`, regardless
    // of which half (fix or ci-heal) produced it — a ci-heal-side entry is never dropped or siloed from the
    // SAME self-resync signal (`withSelfSync`'s `hasStaleRefusal` option) a fix-side one already triggers.
    expect(hasStaleMainRefusal(out)).toBe(true);
  });
});

// #xngv3vn — SOURCE-CONTRACT proof that the REAL `buildCliDaemonEffects` (no injection point for its own
// `tickOnce`, which always builds the real dispatch functions — see this file's existing `buildCliDaemonEffects`
// suite, which deliberately never CALLS `tickOnce`, only checks its shape, for the same reason) is wired to
// `runTickAllRepos` and not to the old fix-only `runReconcileFixDispatchAllRepos()` call it used to make. This
// mirrors this repo's own established norm for proving a call-site wiring fact inside code that is expensive or
// unsafe to execute directly in a unit test (see e.g. `merge-ai-prs-ai-detection-and-drain-ordering.test.mjs`'s
// #984 F2 block, or this fix's sibling `merge-ai-prs-merge-trace-post-confirm.test.mjs`).
describe('buildCliDaemonEffects — tickOnce is wired to runTickAllRepos, not the old fix-only call (#xngv3vn)', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'reconcile-fix-dispatch-daemon.mjs'), 'utf8');

  it('tickOnce calls runTickAllRepos()', () => {
    const m = src.match(/tickOnce: \(\) => (\w+)\(\),/);
    expect(m).not.toBeNull();
    expect(m[1]).toBe('runTickAllRepos');
  });

  it('runTickAllRepos itself calls BOTH runReconcileFixDispatchAllRepos and runReconcileCiHealDispatchAllRepos', () => {
    const start = src.indexOf('export async function runTickAllRepos(');
    expect(start).toBeGreaterThan(-1);
    const body = src.slice(start, src.indexOf('\n}\n', start));
    expect(body).toMatch(/runReconcileFixDispatchAllRepos\(/);
    expect(body).toMatch(/await runReconcileCiHealDispatchAllRepos\(/);
  });
});
