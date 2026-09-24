/**
 * @file skills-src/conveyor/__tests__/review-daemon.test.mjs
 * @description Unit proof of #3876's standalone Review daemon — the pure loop (mirrors #3870's own tests)
 *   and the per-tick sequence, both with every effect injected (no real gh/claude, no real lease/timer).
 */
import { describe, it, expect, vi } from 'vitest';

// Mocked so `defaultReapSessions`'s own describe block below can assert exactly what it passes through
// WITHOUT ever shelling a real `claude agents`/`claude stop`/`gh` call — this repo's own hard rule (never touch
// a real process in a test; inject a fake). `session-reaper.mjs`'s OWN test suite
// (scripts/conveyor/__tests__/session-reaper.test.mjs) already proves `runSessionReaperPass`'s real behavior;
// this file only needs to prove review-daemon.mjs wires it correctly.
const runSessionReaperPassMock = vi.fn(() => ({ scanned: 0, stopped: 0, alreadyGone: 0, failures: 0, anomalies: 0, kept: 0 }));
vi.mock('../../../scripts/conveyor/session-reaper.mjs', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, runSessionReaperPass: (...args) => runSessionReaperPassMock(...args) };
});

import {
  runDaemonLoop, runReviewTick, runReviewTickAllRepos, REVIEW_DAEMON_REPOS, buildCliDaemonEffects, realSleep,
  REVIEW_DAEMON_LEASE_KEY, DEFAULT_INTERVAL_MS, defaultReapSessions, hasStaleMainRefusal,
} from '../review-daemon.mjs';
import { planReviewDispatch } from '../../../scripts/operations/review-dispatch.mjs';
import { CONSTELLATION_REPOS } from '../../../scripts/lib/constellation-repos.mjs';
import { REPO_ROOT as SESSION_REAPER_REPO_ROOT, DEFAULT_IDLE_REAP_THRESHOLD_MS } from '../../../scripts/conveyor/session-reaper.mjs';
import { assertMainNotStale } from '../../../scripts/lib/main-staleness.mjs';

// #3383 bug 1 — wired into withSelfSync's `hasStaleRefusal` option in main(); tested here in isolation
// (pure, no IO) against the exact shapes `runReviewTickAllRepos` returns (`failed[]` per-PR, `repos[].error`
// whole-repo).
describe('hasStaleMainRefusal', () => {
  const staleMessage = () => {
    let message = null;
    try { assertMainNotStale('/repo', () => ({ action: 'warn', reason: 'diverged', behind: 1, ahead: 5, dirty: false })); }
    catch (e) { message = e.message; }
    return message;
  };
  it('true when a per-PR dispatch failed with the real assertMainNotStale refusal message', () => {
    expect(hasStaleMainRefusal({ failed: [{ prNumber: 42, repo: 'chalbert/web-everything', error: staleMessage() }] })).toBe(true);
  });
  it('true when a WHOLE-REPO tick failed with it (forEachRepo\'s own {repo, error} capture)', () => {
    expect(hasStaleMainRefusal({ repos: [{ repo: 'chalbert/plateau-app', error: staleMessage() }] })).toBe(true);
  });
  it('false for an ordinary, unrelated failure in either shape', () => {
    expect(hasStaleMainRefusal({ failed: [{ prNumber: 1, error: 'gh: rate limited' }] })).toBe(false);
    expect(hasStaleMainRefusal({ repos: [{ repo: 'x', error: 'ENOTFOUND' }] })).toBe(false);
  });
  it('false with nothing failed, or a missing/malformed result', () => {
    expect(hasStaleMainRefusal({ failed: [], repos: [] })).toBe(false);
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
    const tickOnce = vi.fn(async () => ({ reviewsOwed: 0 }));
    const out = await runDaemonLoop({ tickOnce, sleep, maxTicks: 3 });
    expect(tickOnce).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(out).toEqual({ ticks: 3, stoppedReason: 'max-ticks' });
  });

  it('a failing tick is isolated — reported via onTickError, never fatal', async () => {
    const onTickError = vi.fn();
    let n = 0;
    const tickOnce = vi.fn(async () => { n += 1; if (n === 1) throw new Error('gh hiccup'); return {}; });
    const out = await runDaemonLoop({ tickOnce, sleep: async () => {}, onTickError, maxTicks: 2 });
    expect(onTickError).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ ticks: 2, stoppedReason: 'max-ticks' });
  });

  it('a lost heartbeat stops the loop immediately', async () => {
    let hb = 0;
    const heartbeat = vi.fn(async () => { hb += 1; return hb < 2; });
    const sleep = vi.fn(async () => {});
    const out = await runDaemonLoop({ tickOnce: async () => ({}), sleep, heartbeat, maxTicks: Infinity });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ ticks: 2, stoppedReason: 'lease-lost' });
  });
});

describe('runReviewTick — the per-tick sequence', () => {
  const owedPlan = (entries, refusals = []) => ({ dispatch: entries, refusals });

  it('dispatches every review-kind entry, tags its round, and ignores non-review kinds', () => {
    const reconcile = vi.fn(() => owedPlan([
      { kind: 'review', prNumber: 10, attempts: 1 },
      { kind: 'fix', prNumber: 11 }, // not this daemon's job
    ]));
    const dispatch = vi.fn(({ pr }) => ({ agentId: `agent-${pr}` }));
    const tagRound = vi.fn();
    const tagStatus = vi.fn();
    const out = runReviewTick({ reconcile, dispatch, tagRound, tagStatus, statusCandidates: () => [] });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ pr: 10, repo: 'chalbert/web-everything' });
    expect(tagRound).toHaveBeenCalledWith({ pr: 10, repo: expect.any(String), round: 2 }); // attempts+1
    expect(out).toEqual({ reviewsOwed: 1, dispatched: [{ prNumber: 10, agentId: 'agent-10' }], failed: [], refusals: 0, reconcileError: null });
  });

  it('a failed dispatch is isolated: no round tag, recorded in failed, does not stop the tick', () => {
    const reconcile = vi.fn(() => owedPlan([{ kind: 'review', prNumber: 10, attempts: 0 }, { kind: 'review', prNumber: 20, attempts: 0 }]));
    const dispatch = vi.fn(({ pr }) => { if (pr === 10) throw new Error('checkout stale'); return { agentId: 'a20' }; });
    const tagRound = vi.fn();
    const out = runReviewTick({ reconcile, dispatch, tagRound, tagStatus: () => {}, statusCandidates: () => [] });
    expect(tagRound).toHaveBeenCalledTimes(1);
    expect(tagRound).toHaveBeenCalledWith(expect.objectContaining({ pr: 20 }));
    expect(out.failed).toEqual([{ prNumber: 10, error: 'checkout stale' }]);
    expect(out.dispatched).toEqual([{ prNumber: 20, agentId: 'a20' }]);
  });

  it('a failing tag (round or status) never fails the tick — cosmetic only', () => {
    const reconcile = vi.fn(() => owedPlan([{ kind: 'review', prNumber: 10, attempts: 0 }]));
    const dispatch = vi.fn(() => ({ agentId: 'a10' }));
    const tagRound = vi.fn(() => { throw new Error('gh label API down'); });
    const tagStatus = vi.fn(() => { throw new Error('gh label API down'); });
    const out = runReviewTick({ reconcile, dispatch, tagRound, tagStatus, statusCandidates: (r) => r });
    expect(out.dispatched).toEqual([{ prNumber: 10, agentId: 'a10' }]);
    expect(out.failed).toEqual([]);
  });

  it('status candidates cover both the reviews owed and non-nothing-owed refusals (via the injected selector)', () => {
    const reviews = [{ kind: 'review', prNumber: 10, attempts: 0 }];
    const refusals = [{ kind: 'needs-human', prNumber: 30 }];
    const reconcile = vi.fn(() => owedPlan(reviews, refusals));
    const statusCandidates = vi.fn((r, ref) => [...r, ...ref]);
    const tagStatus = vi.fn();
    runReviewTick({ reconcile, dispatch: () => ({ agentId: 'a' }), tagRound: () => {}, tagStatus, statusCandidates });
    expect(statusCandidates).toHaveBeenCalledWith(reviews, refusals, []);
    expect(tagStatus).toHaveBeenCalledTimes(2);
  });

  // Live-caught 2026-09-22, #xli631k: a PR owed a FIX (not a review) used to never reach statusCandidates at
  // all, so review-status:reviewing sat stale once its review session finished (PR #2472, ~2h stale).
  it('fix-kind dispatch entries reach statusCandidates as its own third argument, not silently dropped', () => {
    const reviews = [{ kind: 'review', prNumber: 10, attempts: 0 }];
    const fixes = [{ kind: 'fix', prNumber: 20, attempts: 1 }];
    const reconcile = vi.fn(() => owedPlan([...reviews, ...fixes], []));
    const statusCandidates = vi.fn(() => []);
    runReviewTick({ reconcile, dispatch: () => ({ agentId: 'a' }), tagRound: () => {}, tagStatus: () => {}, statusCandidates });
    expect(statusCandidates).toHaveBeenCalledWith(reviews, [], fixes);
  });

  it('an agent id missing from the dispatch result records null, not undefined or a throw', () => {
    const reconcile = vi.fn(() => owedPlan([{ kind: 'review', prNumber: 10, attempts: 0 }]));
    const out = runReviewTick({ reconcile, dispatch: () => ({}), tagRound: () => {}, tagStatus: () => {}, statusCandidates: () => [] });
    expect(out.dispatched).toEqual([{ prNumber: 10, agentId: null }]);
  });

  it('no reviews owed → dispatches nothing, still runs the status sweep', () => {
    const reconcile = vi.fn(() => owedPlan([], [{ kind: 'ci-red', prNumber: 40 }]));
    const tagStatus = vi.fn();
    const out = runReviewTick({ reconcile, dispatch: () => { throw new Error('should not be called'); }, tagRound: () => {}, tagStatus, statusCandidates: (r, ref) => ref });
    expect(out).toMatchObject({ reviewsOwed: 0, dispatched: [], failed: [], refusals: 1 });
    expect(tagStatus).toHaveBeenCalledTimes(1);
  });
});

describe('runReviewTick — reconcile itself is isolated (regression, #xvzwiew live-caught 2026-09-23)', () => {
  // Live production evidence (`~/workspace/wev-review-daemon/.conveyor/review-daemon.log`):
  //   review-daemon: chalbert/frontierui#? failed (non-fatal): spawnSync claude ENOENT
  //   review-daemon: chalbert/frontierui reconcile failed (non-fatal, other repos unaffected): spawnSync claude ENOENT
  // Both lines were ONE underlying failure — `reconcile-pass.mjs`'s own `claude agents --json` read throwing —
  // reported twice and misleadingly: the first line reads as if a SPECIFIC PR's review dispatch failed, but no
  // PR was ever identified (reconcile crashed before `dispatch` could even be reached).
  const throwingClaudeSpawn = () => {
    const err = new Error('spawnSync claude ENOENT');
    err.code = 'ENOENT';
    throw err;
  };

  it('a reconcile throw no longer escapes runReviewTick — it comes back as reconcileError, not a thrown exception', () => {
    const reconcile = vi.fn(() => throwingClaudeSpawn());
    const dispatch = vi.fn();
    expect(() => runReviewTick({ reconcile, dispatch, tagRound: () => {}, tagStatus: () => {}, statusCandidates: () => [] }))
      .not.toThrow();
    const out = runReviewTick({ reconcile, dispatch, tagRound: () => {}, tagStatus: () => {}, statusCandidates: () => [] });
    expect(out).toEqual({
      reviewsOwed: 0, dispatched: [], failed: [], refusals: 0, reconcileError: 'spawnSync claude ENOENT',
    });
    expect(dispatch).not.toHaveBeenCalled(); // reconcile crashed before any PR was identified
  });

  it('a successful reconcile still reports reconcileError: null (never undefined)', () => {
    const reconcile = vi.fn(() => ({ dispatch: [], refusals: [] }));
    const out = runReviewTick({ reconcile, dispatch: () => ({}), tagRound: () => {}, tagStatus: () => {}, statusCandidates: () => [] });
    expect(out.reconcileError).toBeNull();
  });
});

describe('runReviewTick — repo reaches reconcile too (regression, #xvyuwtg live-caught 2026-09-22)', () => {
  // plateau-app PR #167 sat `review:pending` with nothing watching it: `repo` reached `dispatch`/`tagRound`/
  // `tagStatus` but `reconcile` was always called as `reconcile({})`, so a tick "for" plateau-app still
  // discovered WE's own PRs. Fixed by passing `{repo}` into `reconcile` too.
  it('reconcile is called with the SAME repo this tick was given, not unconditionally omitted', () => {
    const reconcile = vi.fn(() => ({ dispatch: [], refusals: [] }));
    runReviewTick({ reconcile, dispatch: () => ({}), tagRound: () => {}, tagStatus: () => {}, statusCandidates: () => [], repo: 'chalbert/plateau-app' });
    expect(reconcile).toHaveBeenCalledWith({ repo: 'chalbert/plateau-app' });
  });
});

describe('runReviewTick — real dispatchReview contract (regression, #3876 live-caught)', () => {
  // Live-caught 2026-09-22: `dispatch({ pr, repo: null })` passed the mock's own tests (which mocked
  // `dispatch` entirely) but broke the FIRST real run — `planReviewDispatch` does `String(repo ?? '').trim()`
  // then `repoKeyForSlug(repoStr)`, so `null` becomes `''`, which is not a constellation repo, unlike
  // `reconcile-pass.mjs`/`reconcile-fix-dispatch.mjs`'s OWN convention where `repo: null` defaults to 'we'.
  // This test calls the REAL (pure, no-IO) `planReviewDispatch` with the exact `repo` value `runReviewTick`
  // passes, so a future reintroduction of `repo: null` fails here even if every `dispatch` mock still passes.
  it('the repo value passed to dispatch is one planReviewDispatch actually accepts', () => {
    let capturedRepo;
    const dispatch = ({ repo }) => { capturedRepo = repo; return { agentId: 'a' }; };
    runReviewTick({
      reconcile: () => ({ dispatch: [{ kind: 'review', prNumber: 10, attempts: 0 }], refusals: [] }),
      dispatch, tagRound: () => {}, tagStatus: () => {}, statusCandidates: () => [],
    });
    expect(() => planReviewDispatch({ pr: 10, repo: capturedRepo })).not.toThrow();
  });
});

describe('REVIEW_DAEMON_REPOS', () => {
  it('is every constellation repo\'s real slug, not just WE (live-caught 2026-09-22, #xvyuwtg: plateau-app PR #167 sat unwatched)', () => {
    expect(REVIEW_DAEMON_REPOS.sort()).toEqual(Object.values(CONSTELLATION_REPOS).map((r) => r.slug).sort());
    expect(REVIEW_DAEMON_REPOS).toContain('chalbert/plateau-app');
    expect(REVIEW_DAEMON_REPOS).toContain('chalbert/frontierui');
    expect(REVIEW_DAEMON_REPOS).toContain('chalbert/web-everything');
  });
});

describe('runReviewTickAllRepos — one runReviewTick call per watched repo', () => {
  it('ticks every repo in the list, tagging each dispatched/failed entry with its own repo', () => {
    const tick = vi.fn(({ repo }) => (repo === 'repo-a'
      ? { reviewsOwed: 1, dispatched: [{ prNumber: 10, agentId: 'a10' }], failed: [], refusals: 0 }
      : { reviewsOwed: 1, dispatched: [], failed: [{ prNumber: 20, error: 'boom' }], refusals: 1 }));
    const out = runReviewTickAllRepos({ repos: ['repo-a', 'repo-b'], tick });
    expect(tick).toHaveBeenCalledTimes(2);
    expect(tick).toHaveBeenCalledWith(expect.objectContaining({ repo: 'repo-a' }));
    expect(tick).toHaveBeenCalledWith(expect.objectContaining({ repo: 'repo-b' }));
    expect(out.reviewsOwed).toBe(2);
    expect(out.refusals).toBe(1);
    expect(out.dispatched).toEqual([{ prNumber: 10, agentId: 'a10', repo: 'repo-a' }]);
    expect(out.failed).toEqual([{ prNumber: 20, error: 'boom', repo: 'repo-b' }]);
    expect(out.repos).toEqual([
      { repo: 'repo-a', result: expect.any(Object) },
      { repo: 'repo-b', result: expect.any(Object) },
    ]);
  });

  it('one repo throwing (a gh outage, a rate limit) never stops the others — isolated the same way a bad PR is isolated one level down', () => {
    const tick = vi.fn(({ repo }) => {
      if (repo === 'repo-bad') throw new Error('gh: rate limited');
      return { reviewsOwed: 1, dispatched: [{ prNumber: 1, agentId: 'a1' }], failed: [], refusals: 0 };
    });
    const out = runReviewTickAllRepos({ repos: ['repo-bad', 'repo-good'], tick });
    expect(out.dispatched).toEqual([{ prNumber: 1, agentId: 'a1', repo: 'repo-good' }]);
    expect(out.failed).toEqual([{ prNumber: null, repo: 'repo-bad', error: 'gh: rate limited' }]);
    expect(out.repos[0]).toEqual({ repo: 'repo-bad', error: 'gh: rate limited' });
  });

  it('every non-`repo` option is forwarded to every repo\'s own tick call', () => {
    const tick = vi.fn(() => ({ reviewsOwed: 0, dispatched: [], failed: [], refusals: 0 }));
    const dispatch = () => ({});
    runReviewTickAllRepos({ repos: ['repo-a'], tick, dispatch });
    expect(tick).toHaveBeenCalledWith({ dispatch, repo: 'repo-a' });
  });

  // Regression, #xvzwiew live-caught 2026-09-23: a repo whose `runReviewTick` catches its own reconcile
  // failure (see the sibling describe block above) used to have NO way to surface that — before this fix,
  // `runReviewTick` just threw, `forEachRepo` caught it, and this function double-reported it (once as a
  // bogus `prNumber: null` "failed dispatch", once as `repos[].error`). Now `runReviewTick` never throws for
  // a reconcile failure; it returns `reconcileError` instead, and THIS function must fold that into its own
  // `reconcileFailed` bucket — never into `failed` (that would resurrect the exact misleading report this
  // whole fix removes).
  it('a repo whose tick reports reconcileError is folded into reconcileFailed, never into failed', () => {
    const tick = vi.fn(({ repo }) => (repo === 'chalbert/frontierui'
      ? { reviewsOwed: 0, dispatched: [], failed: [], refusals: 0, reconcileError: 'spawnSync claude ENOENT' }
      : { reviewsOwed: 1, dispatched: [{ prNumber: 1, agentId: 'a1' }], failed: [], refusals: 0, reconcileError: null }));
    const out = runReviewTickAllRepos({ repos: ['chalbert/web-everything', 'chalbert/frontierui'], tick });
    expect(out.failed).toEqual([]); // no bogus `prNumber: null` dispatch failure
    expect(out.reconcileFailed).toEqual([{ repo: 'chalbert/frontierui', error: 'spawnSync claude ENOENT' }]);
    expect(out.dispatched).toEqual([{ prNumber: 1, agentId: 'a1', repo: 'chalbert/web-everything' }]);
    expect(out.reviewsOwed).toBe(1); // the healthy repo's own count is untouched by the other repo's reconcile failure
  });

  it('defaults to REVIEW_DAEMON_REPOS and to the real runReviewTick when nothing is injected', () => {
    // No network call happens here: reconcile-pass.mjs's OWN default readers are what would hit `gh`, and this
    // test injects neither `repos` nor `tick`'s inner effects — it only proves the DEFAULTS are wired, via a
    // spy on `tick` itself so the real runReviewTick's own IO defaults are never reached.
    const tick = vi.fn(() => ({ reviewsOwed: 0, dispatched: [], failed: [], refusals: 0 }));
    const out = runReviewTickAllRepos({ tick });
    expect(tick).toHaveBeenCalledTimes(REVIEW_DAEMON_REPOS.length);
    expect(out.repos.map((r) => r.repo)).toEqual(REVIEW_DAEMON_REPOS);
  });
});

describe('REVIEW_DAEMON_LEASE_KEY / DEFAULT_INTERVAL_MS', () => {
  it('is a distinct key, never the Dispatcher default or #3870\'s own key', () => {
    expect(REVIEW_DAEMON_LEASE_KEY).toBe('<conveyor:review-daemon-lease>');
    expect(REVIEW_DAEMON_LEASE_KEY).not.toBe('<conveyor:runner-singleton-lease>');
    expect(REVIEW_DAEMON_LEASE_KEY).not.toBe('<conveyor:reconcile-fix-dispatch-daemon-lease>');
  });

  it('matches the runner\'s own tick cadence', () => {
    expect(DEFAULT_INTERVAL_MS).toBe(120_000);
  });
});

describe('buildCliDaemonEffects — the real-effect factory (heartbeat wiring only)', () => {
  it('exposes the shape runDaemonLoop needs', () => {
    const effects = buildCliDaemonEffects({ owner: 'x' });
    expect(effects.intervalMs).toBe(DEFAULT_INTERVAL_MS);
    expect(typeof effects.tickOnce).toBe('function');
    expect(typeof effects.sleep).toBe('function');
    expect(typeof effects.heartbeat).toBe('function');
    expect(typeof effects.onTick).toBe('function');
    expect(typeof effects.onTickError).toBe('function');
  });
});

// ── epic #3383: this daemon now ALSO ticks the session reaper (we:scripts/conveyor/session-reaper.mjs), the
//    pass that used to live only inside the retired runner.mjs dispatcher. See review-daemon.mjs's own file
//    header ("THE SESSION REAPER LIVES HERE TOO") for the ownership decision and its justification. ──────────

describe('buildCliDaemonEffects.tickOnce — now also runs a session-reap pass each tick (epic #3383)', () => {
  // `runReview` is injected here too (a fake, never the real `runReviewTickAllRepos`) — this describe block
  // proves the FOLD of `reapSessions()` onto the tick result, not the review tick itself (that is
  // `runReviewTickAllRepos`'s own describe block, above), and must never shell a real `gh`/`claude` call.
  const fakeReview = () => ({ repos: [], reviewsOwed: 1, dispatched: [], failed: [] });

  it('folds the injected reapSessions() result onto the review tick result, under `sessionReap`', async () => {
    const reapSessions = vi.fn(() => ({ scanned: 3, stopped: 1, alreadyGone: 0, failures: 0, anomalies: 0, kept: 2 }));
    const effects = buildCliDaemonEffects({ owner: 'x', reapSessions, runReview: fakeReview });
    const result = await effects.tickOnce();
    expect(reapSessions).toHaveBeenCalledTimes(1);
    expect(result.sessionReap).toEqual({ scanned: 3, stopped: 1, alreadyGone: 0, failures: 0, anomalies: 0, kept: 2 });
    // The review tick's own fields are still present — folding sessionReap on never replaces them.
    expect(result).toHaveProperty('repos');
    expect(result.reviewsOwed).toBe(1);
  });

  it('a session-reap failure is swallowed (logged, non-fatal) — never breaks the review tick', async () => {
    const reapSessions = () => { throw new Error('claude agents unreadable'); };
    const log = { error: vi.fn() };
    const effects = buildCliDaemonEffects({ owner: 'x', reapSessions, runReview: fakeReview, log });
    const result = await effects.tickOnce();
    expect(result.sessionReap).toBeNull();
    expect(log.error).toHaveBeenCalledWith(expect.stringMatching(/session-reap failed \(non-fatal\)/));
    expect(result).toHaveProperty('repos'); // the review tick itself still ran to completion
  });

  it('onTick logs the session-reap summary line when one is present, and skips it when `unreadable`', () => {
    const log = { error: vi.fn() };
    const effects = buildCliDaemonEffects({ owner: 'x', log });
    effects.onTick({ repos: [], reviewsOwed: 0, dispatched: [], failed: [], sessionReap: { scanned: 5, stopped: 2, alreadyGone: 1, failures: 0, anomalies: 0, kept: 2 } });
    expect(log.error).toHaveBeenCalledWith(expect.stringMatching(/session-reap — 5 scanned, 2 stopped, 1 already gone, 2 kept/));

    log.error.mockClear();
    effects.onTick({ repos: [], reviewsOwed: 0, dispatched: [], failed: [], sessionReap: { unreadable: true } });
    expect(log.error.mock.calls.some((c) => /session-reap —/.test(c[0]))).toBe(false);

    log.error.mockClear();
    effects.onTick({ repos: [], reviewsOwed: 0, dispatched: [], failed: [], sessionReap: null });
    expect(log.error.mock.calls.some((c) => /session-reap —/.test(c[0]))).toBe(false);
  });
});

describe('defaultReapSessions — wiring, scoped stricter than session-reaper.mjs\'s own CLI default', () => {
  it('calls runSessionReaperPass with allowedCwd/neverReapWorking/idleThresholdMs set (never a real claude/gh call)', () => {
    runSessionReaperPassMock.mockClear();
    const result = defaultReapSessions();
    expect(runSessionReaperPassMock).toHaveBeenCalledTimes(1);
    expect(runSessionReaperPassMock).toHaveBeenCalledWith({
      allowedCwd: SESSION_REAPER_REPO_ROOT,
      neverReapWorking: true,
      idleThresholdMs: DEFAULT_IDLE_REAP_THRESHOLD_MS,
    });
    expect(result).toEqual({ scanned: 0, stopped: 0, alreadyGone: 0, failures: 0, anomalies: 0, kept: 0 });
  });
});

describe('realSleep — regression, live-caught on THIS daemon\'s own first launchd-managed run', () => {
  // The actual incident that surfaced this whole bug class: this daemon, deployed to a dedicated
  // launchd-managed clone, exited right after its first tick instead of looping. `.unref()`-ing the sleep
  // timer told Node it was fine to exit before it fired, and nothing else kept the event loop alive between
  // ticks. The SAME pattern was copied into #3870's and #3871's own daemons and fixed there too.
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
});
