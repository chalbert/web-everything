/**
 * @file skills-src/conveyor/__tests__/review-daemon.test.mjs
 * @description Unit proof of #3876's standalone Review daemon — the pure loop (mirrors #3870's own tests)
 *   and the per-tick sequence, both with every effect injected (no real gh/claude, no real lease/timer).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  runDaemonLoop, runReviewTick, runReviewTickAllRepos, REVIEW_DAEMON_REPOS, buildCliDaemonEffects, realSleep,
  REVIEW_DAEMON_LEASE_KEY, DEFAULT_INTERVAL_MS,
} from '../review-daemon.mjs';
import { planReviewDispatch } from '../../../scripts/operations/review-dispatch.mjs';
import { CONSTELLATION_REPOS } from '../../../scripts/lib/constellation-repos.mjs';

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
    expect(out).toEqual({ reviewsOwed: 1, dispatched: [{ prNumber: 10, agentId: 'agent-10' }], failed: [], refusals: 0 });
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
