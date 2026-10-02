/**
 * @file promote-draft-pr-dispatch.test.mjs — draft-first PRs (operator-approved 2026-09-27):
 *   `runReconcilePromoteDraftDispatch`, the mechanical pass that calls `gh pr ready` on every PR
 *   `reconcile-core.mjs` planned `kind:'promote-draft'` for. No process is started and no real `gh` is
 *   shelled — `reconcile` and `provider` are injected, mirroring `ci-heal-pr-dispatch.test.mjs`'s own shape.
 */
import { describe, it, expect, vi } from 'vitest';
import { runReconcilePromoteDraftDispatch, defaultReadHeadCheckState } from '../promote-draft-pr-dispatch.mjs';

const FRESH = () => ({ fresh: true, behind: 0 });
// Every pre-existing test in this file promotes cleanly, so it pins a fresh re-read that always says green —
// the #2811 race itself (a fresh read that disagrees with the plan) gets its OWN describe block below.
const ALWAYS_GREEN = () => ({ state: 'green', why: 'all required checks succeeded', counts: {} });
const NOOP_STATUS = () => {};

describe('runReconcilePromoteDraftDispatch (draft-first PRs)', () => {
  it('calls provider.ready for every promote-draft entry, and nothing else', async () => {
    const readyCalls = [];
    const result = runReconcilePromoteDraftDispatch({
      root: '/repo',
      reconcile: () => ({
        dispatch: [
          { kind: 'promote-draft', prNumber: 101, headRefOid: 'a'.repeat(40) },
          { kind: 'review', prNumber: 102 },
          { kind: 'ci-heal', prNumber: 103 },
          { kind: 'promote-draft', prNumber: 104, headRefOid: 'b'.repeat(40) },
        ],
        refusals: [],
      }),
      provider: { ready: (pr) => { readyCalls.push(pr); } },
      checkStaleness: FRESH,
      readHeadCheckState: ALWAYS_GREEN,
      clearAwaitingCi: NOOP_STATUS,
    });
    expect(readyCalls).toEqual([101, 104]);
    expect(result.dispatched).toEqual([{ pr: 101, kind: 'promote-draft' }, { pr: 104, kind: 'promote-draft' }]);
    expect(result.refusals).toEqual([]);
  });

  it('an empty plan promotes nothing and refuses nothing', () => {
    const result = runReconcilePromoteDraftDispatch({
      root: '/repo', reconcile: () => ({ dispatch: [], refusals: [] }),
      provider: { ready: () => { throw new Error('must not be called'); } },
      checkStaleness: FRESH,
      readHeadCheckState: () => { throw new Error('must not be called'); },
      clearAwaitingCi: NOOP_STATUS,
    });
    expect(result).toEqual({ dispatched: [], refusals: [], reconcileRefusals: 0, reconcileRefusalDetails: [] });
  });

  it('a gh failure on one PR is reported as a refusal and does not stop the rest of the batch', () => {
    const readyCalls = [];
    const result = runReconcilePromoteDraftDispatch({
      root: '/repo',
      reconcile: () => ({
        dispatch: [
          { kind: 'promote-draft', prNumber: 55, headRefOid: 'c'.repeat(40) },
          { kind: 'promote-draft', prNumber: 56, headRefOid: 'd'.repeat(40) },
        ],
        refusals: [],
      }),
      provider: {
        ready: (pr) => {
          readyCalls.push(pr);
          if (pr === 55) throw new Error('gh pr ready failed: HTTP 502');
        },
      },
      checkStaleness: FRESH,
      readHeadCheckState: ALWAYS_GREEN,
      clearAwaitingCi: NOOP_STATUS,
    });
    expect(readyCalls).toEqual([55, 56]);
    expect(result.dispatched).toEqual([{ pr: 56, kind: 'promote-draft' }]);
    expect(result.refusals).toEqual([{ pr: 55, kind: 'ready-failed', why: 'gh pr ready failed: HTTP 502' }]);
  });

  it('carries the reconcile pass\'s own refusal count through, unmodified', () => {
    const result = runReconcilePromoteDraftDispatch({
      root: '/repo',
      reconcile: () => ({ dispatch: [], refusals: [{ kind: 'draft', prNumber: 9 }] }),
      provider: { ready: () => {} },
      checkStaleness: FRESH,
      readHeadCheckState: ALWAYS_GREEN,
      clearAwaitingCi: NOOP_STATUS,
    });
    expect(result.reconcileRefusals).toBe(1);
    expect(result.reconcileRefusalDetails).toEqual([{ kind: 'draft', prNumber: 9 }]);
  });

  it('refuses an unknown --repo before ever calling reconcile or provider', () => {
    expect(() => runReconcilePromoteDraftDispatch({
      root: '/repo', repo: 'unknown/repo',
      reconcile: () => { throw new Error('must not be called'); },
      provider: { ready: () => { throw new Error('must not be called'); } },
      checkStaleness: FRESH,
      readHeadCheckState: () => { throw new Error('must not be called'); },
      clearAwaitingCi: NOOP_STATUS,
    })).toThrow(/not a constellation repo/);
  });

  it('reads a shared `--prs-file=` snapshot instead of asking `reconcile` for a fresh gh read, when given one', () => {
    let seenReadPrs = null;
    runReconcilePromoteDraftDispatch({
      root: '/repo', prsFile: '/tmp/some-file.json',
      reconcile: (opts) => { seenReadPrs = typeof opts.readPrs; return { dispatch: [], refusals: [] }; },
      provider: { ready: () => {} },
      checkStaleness: FRESH,
      readHeadCheckState: ALWAYS_GREEN,
      clearAwaitingCi: NOOP_STATUS,
    });
    expect(seenReadPrs).toBe('function');
  });
});

describe('runReconcilePromoteDraftDispatch — stale-green re-verification (#2811)', () => {
  const HEAD = 'e52307860'.padEnd(40, '0');

  it('refuses to promote when a fresh per-sha read disagrees with the plan\'s own (stale) green read', () => {
    const readyCalls = [];
    const seenArgs = [];
    const result = runReconcilePromoteDraftDispatch({
      root: '/repo',
      reconcile: () => ({ dispatch: [{ kind: 'promote-draft', prNumber: 2811, headRefOid: HEAD }], refusals: [] }),
      provider: { ready: (pr) => { readyCalls.push(pr); } },
      checkStaleness: FRESH,
      readHeadCheckState: (o) => { seenArgs.push(o); return { state: 'red', why: '1 of 1 check(s) concluded failing', counts: {} }; },
      clearAwaitingCi: NOOP_STATUS,
    });
    // THE WHOLE POINT: `gh pr ready` is never called once the fresh read disagrees.
    expect(readyCalls).toEqual([]);
    expect(result.dispatched).toEqual([]);
    expect(result.refusals).toEqual([{
      pr: 2811, kind: 'stale-check-refused', headSha: HEAD, checkState: 'red',
      why: expect.stringContaining('stale-green read'),
    }]);
    // Re-verified for the EXACT head sha the plan carried, never re-derived from the PR number.
    expect(seenArgs).toEqual([{ repoSlug: 'chalbert/web-everything', sha: HEAD }]);
  });

  it('still refuses on a fresh `pending` read — only a completed, all-succeeded read promotes', () => {
    const result = runReconcilePromoteDraftDispatch({
      root: '/repo',
      reconcile: () => ({ dispatch: [{ kind: 'promote-draft', prNumber: 2812, headRefOid: HEAD }], refusals: [] }),
      provider: { ready: () => { throw new Error('must not be called'); } },
      checkStaleness: FRESH,
      readHeadCheckState: () => ({ state: 'pending', why: '1 of 2 check(s) still running', counts: {} }),
      clearAwaitingCi: NOOP_STATUS,
    });
    expect(result.dispatched).toEqual([]);
    expect(result.refusals).toEqual([expect.objectContaining({ pr: 2812, kind: 'stale-check-refused', checkState: 'pending' })]);
  });

  it('promotes normally once the fresh re-read confirms green', () => {
    const readyCalls = [];
    const result = runReconcilePromoteDraftDispatch({
      root: '/repo',
      reconcile: () => ({ dispatch: [{ kind: 'promote-draft', prNumber: 2813, headRefOid: HEAD }], refusals: [] }),
      provider: { ready: (pr) => { readyCalls.push(pr); } },
      checkStaleness: FRESH,
      readHeadCheckState: () => ({ state: 'green', why: 'all required checks succeeded', counts: {} }),
      clearAwaitingCi: NOOP_STATUS,
    });
    expect(readyCalls).toEqual([2813]);
    expect(result.dispatched).toEqual([{ pr: 2813, kind: 'promote-draft' }]);
    expect(result.refusals).toEqual([]);
  });

  it('a re-read that cannot be performed at all refuses rather than promoting on the stale plan alone', () => {
    const result = runReconcilePromoteDraftDispatch({
      root: '/repo',
      reconcile: () => ({ dispatch: [{ kind: 'promote-draft', prNumber: 2814, headRefOid: HEAD }], refusals: [] }),
      provider: { ready: () => { throw new Error('must not be called'); } },
      checkStaleness: FRESH,
      readHeadCheckState: () => { throw new Error('gh api rate limited'); },
      clearAwaitingCi: NOOP_STATUS,
    });
    expect(result.dispatched).toEqual([]);
    expect(result.refusals).toEqual([expect.objectContaining({ pr: 2814, kind: 'stale-check-unreadable' })]);
  });

  it('clears the now-stale review-status:awaiting-ci label the instant a draft promotes (#2821)', () => {
    const statusCalls = [];
    const result = runReconcilePromoteDraftDispatch({
      root: '/repo',
      reconcile: () => ({ dispatch: [{ kind: 'promote-draft', prNumber: 2821, headRefOid: HEAD }], refusals: [] }),
      provider: { ready: () => {} },
      checkStaleness: FRESH,
      readHeadCheckState: () => ({ state: 'green', why: 'ok', counts: {} }),
      clearAwaitingCi: (o) => statusCalls.push(o),
    });
    expect(result.dispatched).toEqual([{ pr: 2821, kind: 'promote-draft' }]);
    expect(statusCalls).toEqual([{ pr: 2821, repo: 'chalbert/web-everything', state: null }]);
  });

  describe('defaultReadHeadCheckState — the real per-sha re-read (gh/getRequiredStatusChecks injected)', () => {
    it('asks the commit-statuses endpoint for the exact sha and reduces it against the required set', () => {
      const seenArgv = [];
      const runGh = (argv) => { seenArgv.push(argv); return '{"name":"test","status":"COMPLETED","conclusion":"SUCCESS"}\n'; };
      const getRequiredChecks = () => ({ checks: ['test'], source: 'live' });
      const out = defaultReadHeadCheckState({ repoSlug: 'chalbert/web-everything', sha: HEAD, runGh, getRequiredChecks });
      expect(out.state).toBe('green');
      expect(seenArgv[0]).toEqual(expect.arrayContaining(['api', `repos/chalbert/web-everything/commits/${HEAD}/check-runs`]));
    });

    it('reads red off a completed-failure run', () => {
      const runGh = () => '{"name":"test","status":"COMPLETED","conclusion":"FAILURE"}\n';
      const out = defaultReadHeadCheckState({
        repoSlug: 'chalbert/web-everything', sha: HEAD, runGh, getRequiredChecks: () => ({ checks: ['test'], source: 'live' }),
      });
      expect(out.state).toBe('red');
    });
  });

  describe('cwd-inferred-repo fix (we:backlog/x4ua3v8) — the DEFAULT (un-injected) provider', () => {
    // Modeled on the real live incident: chalbert/plateau-app PR #187, headRefOid c4b00de8… — the daemon runs
    // from the WE checkout (`root`), so before this fix `gh pr ready 187` resolved against
    // `chalbert/web-everything` instead of `chalbert/plateau-app` and refused
    // ("Command failed: gh pr ready 187"). This test does NOT inject `provider` — it exercises the REAL
    // default construction (`createDraftPromoteProvider`), mocking only the underlying `runGhSync` transport
    // so no real `gh` is ever shelled.
    const PLATEAU_HEAD = 'c4b00de87f80f3b459211191d2a619b2026c87cd';

    it('FAILS before the fix / PASSES after: the real default provider calls gh with --repo chalbert/plateau-app for a non-WE entry', async () => {
      const ghThrottle = await import('../../lib/gh-throttle.mjs');
      const runGhSyncSpy = vi.spyOn(ghThrottle, 'runGhSync').mockReturnValue('');
      try {
        const result = runReconcilePromoteDraftDispatch({
          root: '/repo',
          repo: 'chalbert/plateau-app',
          reconcile: () => ({
            dispatch: [{ kind: 'promote-draft', prNumber: 187, headRefOid: PLATEAU_HEAD }],
            refusals: [],
          }),
          checkStaleness: FRESH,
          readHeadCheckState: ALWAYS_GREEN,
          clearAwaitingCi: NOOP_STATUS,
        });
        expect(result.dispatched).toEqual([{ pr: 187, kind: 'promote-draft' }]);
        expect(result.refusals).toEqual([]);
        // THE FIX: the real `gh` transport was called with an explicit `--repo chalbert/plateau-app` — before
        // this fix it was called as `['pr', 'ready', '187']` with no `--repo`, relying on `cwd` inference,
        // which (run from the WE checkout `root`) silently targeted `chalbert/web-everything` instead.
        const readyCall = runGhSyncSpy.mock.calls.find((c) => c[0][0] === 'pr' && c[0][1] === 'ready');
        expect(readyCall[0]).toEqual(['pr', 'ready', '187', '--repo', 'chalbert/plateau-app']);
      } finally {
        runGhSyncSpy.mockRestore();
      }
    });

    it('the WE-default path stays byte-identical (no --repo) — unchanged by this fix', async () => {
      const ghThrottle = await import('../../lib/gh-throttle.mjs');
      const runGhSyncSpy = vi.spyOn(ghThrottle, 'runGhSync').mockReturnValue('');
      try {
        runReconcilePromoteDraftDispatch({
          root: '/repo',
          reconcile: () => ({
            dispatch: [{ kind: 'promote-draft', prNumber: 999, headRefOid: 'f'.repeat(40) }],
            refusals: [],
          }),
          checkStaleness: FRESH,
          readHeadCheckState: ALWAYS_GREEN,
          clearAwaitingCi: NOOP_STATUS,
        });
        const readyCall = runGhSyncSpy.mock.calls.find((c) => c[0][0] === 'pr' && c[0][1] === 'ready');
        expect(readyCall[0]).toEqual(['pr', 'ready', '999']);
      } finally {
        runGhSyncSpy.mockRestore();
      }
    });
  });

  it('a clearAwaitingCi failure is best-effort and never turns a successful promotion into a refusal', () => {
    const result = runReconcilePromoteDraftDispatch({
      root: '/repo',
      reconcile: () => ({ dispatch: [{ kind: 'promote-draft', prNumber: 2822, headRefOid: HEAD }], refusals: [] }),
      provider: { ready: () => {} },
      checkStaleness: FRESH,
      readHeadCheckState: () => ({ state: 'green', why: 'ok', counts: {} }),
      clearAwaitingCi: () => { throw new Error('gh hiccup'); },
    });
    expect(result.dispatched).toEqual([{ pr: 2822, kind: 'promote-draft' }]);
    expect(result.refusals).toEqual([]);
  });
});

it('xxh4zw8 fresh exact-head reader refuses complete cancelled evidence without a ready call', () => {
  const sha = '4ecb5deb362c81aa28de162db4616bb4c2009347';
  const required = ['test', 'smoke', 'daemon-soak', 'soak-replay-gate'];
  const runs = required.map((name, i) => ({ id: 110460009383 + i, name, status: 'completed', conclusion: name === 'smoke' ? 'cancelled' : 'success' }));
  const ready = vi.fn();
  const runGh = vi.fn(() => runs.map(row => JSON.stringify(row)).join('\n'));
  const readHeadCheckState = args => defaultReadHeadCheckState({ ...args, runGh, getRequiredChecks: () => ({ checks: required }) });
  expect(readHeadCheckState({ repoSlug: 'chalbert/web-everything', sha })).toMatchObject({ state: 'red', counts: { total: 4, failed: 1 } });
  const result = runReconcilePromoteDraftDispatch({ root: '/repo', checkStaleness: FRESH,
    reconcile: () => ({ dispatch: [{ kind: 'promote-draft', prNumber: 3336, headRefOid: sha }], refusals: [] }),
    provider: { ready }, readHeadCheckState, clearAwaitingCi: NOOP_STATUS });
  expect(ready).not.toHaveBeenCalled();
  expect(result.dispatched).toEqual([]);
  expect(result.refusals).toHaveLength(1);
  expect(runGh.mock.calls[0][0]).toContain(`repos/chalbert/web-everything/commits/${sha}/check-runs`);
});
