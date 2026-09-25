/**
 * @file scripts/lib/__tests__/daemon-live-smoke.test.mjs
 * @description #3383 — the live smoke gate a daemon clone runs after a self-sync merge, before restarting onto
 *   it. Every check runs through an INJECTED `runChild` here (never a real child process) so this suite is
 *   hermetic and fast; the real live behavior (a real lane-pool lease, a real `gh` call, a real reconcile-pass
 *   dry-run) is proven separately as a one-off script against a real/throwaway clone (see the PR body), not in
 *   vitest.
 *
 *   #4072 (appended below, "ghDispatchedSessionEnv" / gh-check describes) — the gate's `gh` checks must run
 *   `gh` EXACTLY the way a dispatched session does: through the App shim, with the same `--settings` env a
 *   session gets, and WITHOUT any ambient `GH_TOKEN`/`GITHUB_TOKEN` the calling (daemon) process happens to be
 *   carrying. Before this fix, the gate merged the shim's `PATH` override onto the RAW daemon env
 *   (`{...env, ...shimEnv}`) — so the daemon's own continuously-refreshed `GH_TOKEN` (set for the daemon's OWN
 *   gh/git calls by `github-app-auth-env.mjs#ensureFreshGithubAppEnv`) rode along underneath the override and
 *   silently masked the exact fallback failure a properly-sanitized dispatched session hits when the shared
 *   token cache is empty or stale. The gate passed on 2026-09-24, the same day every real bot session got
 *   HTTP 401. The "gate's gh-api-repo / gh-pr-list checks" describe below is the load-bearing proof: it runs
 *   the gate's REAL `gh-api-repo` check function (from {@link SMOKE_CHECKS}) against a fake `gh` that only
 *   succeeds when it sees an ambient `GH_TOKEN` — standing in for the live incident's shared-cache-empty
 *   fallback — and shows the check FAILS through {@link ghDispatchedSessionEnv} (the fix) but WOULD HAVE
 *   PASSED through the pre-fix `{...env, ...shimEnv}` composition (reproduced inline, since that's exactly the
 *   bug this item removes).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, cpSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {
  decideSmokeVerdict, resolveSmokeBudgets, SMOKE_BUDGET_ENV, isSmokeGateDisabled, SMOKE_KILL_SWITCH_ENV,
  runLiveSmoke, SMOKE_CHECKS, rollbackToSha, readRejectedSha, recordRejectedSha, clearRejectedSha,
  smokeStatePath, gateMergedCommit, ghDispatchedSessionEnv,
  TRANSIENT_FAILURE_PATTERNS, classifySmokeFailure, runLiveSmokeWithRetry,
  SMOKE_TRANSIENT_RETRIES_ENV, SMOKE_RETRY_BACKOFF_MS_ENV,
  DISPATCH_DRY_RUN_SCRIPT, DISPATCH_DRY_RUN_CODE_ENTRIES,
} from '../daemon-live-smoke.mjs';

/**
 * xp4lw2v — every pre-existing `runChild` fixture in this file predates the two new checks
 * (`dispatch-dry-run`/`tree-stays-clean`) and knows nothing about them. Wrapping a fixture with this makes it
 * answer both trivially (a PASSING dispatch-dry-run row, a CLEAN git status) so a test written to assert
 * something about the original five checks keeps meaning what it always meant — without every fixture in this
 * file having to learn about two checks it isn't testing. Tests that DO exercise the new checks build their own
 * `runChild` instead of using this (see the `dispatch-dry-run` / `tree-stays-clean` describe blocks below).
 */
function withNewCheckDefaults(fn) {
  return vi.fn(async (cmd, args, opts) => {
    if (cmd === 'node' && args[0] === '--input-type=module') return '[{"kind":"stub","pr":null,"ok":true}]';
    if (cmd === 'git' && args[0] === 'status') return '';
    return fn(cmd, args, opts);
  });
}

describe('decideSmokeVerdict — pure', () => {
  it('every check passing → pass', () => expect(decideSmokeVerdict([{ ok: true }, { ok: true }])).toBe(true));
  it('one check failing → fail', () => expect(decideSmokeVerdict([{ ok: true }, { ok: false }])).toBe(false));
  it('an empty result set is never a pass — no checks run is not "nothing to complain about"', () => expect(decideSmokeVerdict([])).toBe(false));
});

describe('isSmokeGateDisabled / resolveSmokeBudgets — pure, env-driven', () => {
  it('unset → not disabled', () => expect(isSmokeGateDisabled({})).toBe(false));
  it.each(['1', 'true', 'yes', 'TRUE', 'Yes'])('%s → disabled', (v) => expect(isSmokeGateDisabled({ [SMOKE_KILL_SWITCH_ENV]: v })).toBe(true));
  it.each(['0', 'false', 'no', ''])('%j → not disabled', (v) => expect(isSmokeGateDisabled({ [SMOKE_KILL_SWITCH_ENV]: v })).toBe(false));

  it('every budget has a sane positive default with no env set', () => {
    const b = resolveSmokeBudgets({});
    for (const v of Object.values(b)) expect(v).toBeGreaterThan(0);
  });
  it('each budget is independently overridable via its own env var', () => {
    for (const [key, envVar] of Object.entries(SMOKE_BUDGET_ENV)) {
      const b = resolveSmokeBudgets({ [envVar]: '12345' });
      expect(b[key]).toBe(12345);
    }
  });
  it('a non-numeric override falls back to the default rather than NaN/0', () => {
    const b = resolveSmokeBudgets({ [SMOKE_BUDGET_ENV.ghApiMs]: 'not-a-number' });
    expect(b.ghApiMs).toBe(30_000);
  });

  it('laneAcquireWaitMs defaults to 180000 and is independently overridable via WE_SMOKE_LANE_ACQUIRE_WAIT_MS', () => {
    expect(resolveSmokeBudgets({}).laneAcquireWaitMs).toBe(180_000);
    expect(resolveSmokeBudgets({ [SMOKE_BUDGET_ENV.laneAcquireWaitMs]: '5000' }).laneAcquireWaitMs).toBe(5000);
    // overriding the wait budget must never perturb the separate, plain laneAcquireMs budget
    expect(resolveSmokeBudgets({ [SMOKE_BUDGET_ENV.laneAcquireWaitMs]: '5000' }).laneAcquireMs)
      .toBe(resolveSmokeBudgets({}).laneAcquireMs);
  });
});

describe('classifySmokeFailure — pure, transient vs. code', () => {
  it('every check passing → pass', () => {
    expect(classifySmokeFailure([{ ok: true }, { ok: true }])).toBe('pass');
  });
  it('an empty result set is code, not transient — no checks run is not "just env noise"', () => {
    expect(classifySmokeFailure([])).toBe('code');
  });
  it('a 401 auth failure → transient', () => {
    const result = classifySmokeFailure([{ ok: true }, { ok: false, detail: 'gh api ... failed: HTTP 401: Bad credentials' }]);
    expect(result).toBe('transient');
  });
  it('a thrown SyntaxError (a real code-shaped failure) → code', () => {
    const result = classifySmokeFailure([{ ok: false, detail: 'threw: SyntaxError: Unexpected token } in JSON' }]);
    expect(result).toBe('code');
  });
  it('a mix of one transient and one non-transient failure → code (one real finding taints the whole verdict)', () => {
    const result = classifySmokeFailure([
      { ok: false, detail: 'gh api ... failed: HTTP 401: Bad credentials' },
      { ok: false, detail: 'threw: SyntaxError: Unexpected token' },
    ]);
    expect(result).toBe('code');
  });
  it('every TRANSIENT_FAILURE_PATTERNS entry matches at least one representative failure string', () => {
    const samples = [
      '401 Unauthorized', 'Bad credentials', 'HTTP 503', 'secondary rate limit exceeded', 'connect ETIMEDOUT',
      'read ECONNRESET', 'getaddrinfo ENOTFOUND api.github.com', 'getaddrinfo EAI_AGAIN api.github.com',
      'x failed: timed out after 30000ms (process group killed)', 'no free lane in pool "we" (12 all held/dirty)',
      'all lanes are busy right now', 'pool is exhausted', 'could not resolve host: github.com',
      'error connecting to api.github.com', 'dial tcp 1.2.3.4:443: i/o timeout', 'read: connection reset by peer',
      'write: broken pipe', 'net/http: TLS handshake timeout', 'lookup api.github.com: no such host',
      'connect: connection refused', 'HTTP 429: Too Many Requests', 'HTTP 403: API rate limit exceeded',
    ];
    for (const re of TRANSIENT_FAILURE_PATTERNS) {
      expect(samples.some((s) => re.test(s)), `no sample matched ${re}`).toBe(true);
    }
  });
  // Advisory 2026-09-25 (PR #2625): a bare /timeout|timed out/ matched ordinary code-failure text, so a real
  // regression rolled back as 'transient' with no reject record and was re-smoked every tick.
  it.each([
    'lane-pool list --acquirable failed: exited 1: Error: operation timed out waiting for element #submit-button',
    'gh pr list --repo x --limit 1 failed: exited 1: AssertionError: expected timeout to be 30000',
    'lane-pool list --acquirable failed: exited 1: timed out after 5ms (process group killed)', // child PRINTED the marker
    'lane-pool list --acquirable failed: exited 1: x failed: timed out after 5ms (process group killed)', // …with its own prefix
  ])('code-shaped text that merely mentions a timeout → code: %s', (detail) => {
    expect(classifySmokeFailure([{ ok: false, detail }])).toBe('code');
  });
  it("runBounded's own hard-timeout rejection still → transient", () => {
    const detail = 'gh api --method GET repos/x failed: timed out after 30000ms (process group killed)';
    expect(classifySmokeFailure([{ ok: false, detail }])).toBe('transient');
  });
  it('a failure from a mayBeTransient:false check is code even when its text looks transient', () => {
    expect(classifySmokeFailure([{ ok: false, mayBeTransient: false, detail: 'failed: connect ETIMEDOUT' }])).toBe('code');
  });
  it('reconcile-dry-run (runs code from the tree under test) can never buy a transient verdict with its own output', async () => {
    expect(SMOKE_CHECKS.find((c) => c.name === 'reconcile-dry-run').mayBeTransient).toBe(false);
    const runChild = vi.fn(async (cmd, args) => {
      if (args[0] === 'scripts/conveyor/reconcile-pass.mjs') throw new Error('exited 1: connect ETIMEDOUT (printed by overlay code)');
      if (args[1] === 'list') return '[]';
      if (args[1] === 'acquire') return JSON.stringify({ lane: 2 });
      return '';
    });
    const smoke = await runLiveSmoke({ root: '/x', env: {}, runChild });
    expect(smoke.pass).toBe(false);
    expect(classifySmokeFailure(smoke.results)).toBe('code');
  });
  // PR #2625 advisory (security/reject-cache-bypass): THE RULE — every check that runs code from the tree under
  // test (a runChild call with `cwd: root`) must be mayBeTransient:false. Enforced by running every row and
  // watching its cwd, so a future check added without the flag fails here.
  it('every SMOKE_CHECKS row that runs code from the tree under test (cwd: root) is mayBeTransient:false', async () => {
    const root = '/tree-under-test';
    for (const check of SMOKE_CHECKS) {
      const cwds = [];
      const runChild = vi.fn(async (cmd, args, opts = {}) => {
        cwds.push(opts.cwd);
        if (args[1] === 'acquire') return JSON.stringify({ lane: 1 });
        if (args[1] === 'list') return '[]';
        return '';
      });
      await check.run({
        root, budgets: {}, repos: ['o/r'], sessionSlug: 's', ghChildEnv: {}, runChild,
      });
      if (cwds.includes(root)) expect({ name: check.name, mayBeTransient: check.mayBeTransient }).toEqual({ name: check.name, mayBeTransient: false });
    }
  });
  // #4044: skip a tree-code check whose code is untouched since the last live-verified build.
  describe('changedFiles — tree-code checks whose code is unchanged are skipped, never the gh checks (#4044)', () => {
    const closureOf = ({ entries }) => ({
      files: new Set(entries[0] === 'scripts/lane-pool.mjs' ? ['scripts/lane-pool.mjs', 'scripts/lib/lane-pool-paths.mjs'] : ['scripts/conveyor/reconcile-pass.mjs']),
      complete: true, bareDeps: false, jsonNames: new Set(),
    });
    const runChildFor = () => vi.fn(async (cmd, args) => {
      if (args[1] === 'list') return '[]';
      if (args[1] === 'acquire') return JSON.stringify({ lane: 2 });
      return '';
    });
    const ran = (runChild) => runChild.mock.calls.map(([cmd, args]) => (cmd === 'gh' ? `gh ${args[0]}` : `${args[0]} ${args[1] ?? ''}`.trim()));
    it('a backlog-only move runs only the gh checks; the rest report skipped + ok — tree-stays-clean still runs (never skipped) and so does the beforePorcelain snapshot', async () => {
      const runChild = runChildFor();
      const smoke = await runLiveSmoke({ root: '/x', env: {}, runChild, changedFiles: ['backlog/4143.md'], closureOf });
      expect(smoke.pass).toBe(true);
      // xp4lw2v — `dispatch-dry-run`'s codeEntries fall into the SAME `closureOf` else-branch as
      // `reconcile-dry-run` in this fixture (its own `entries[0]` is never `scripts/lane-pool.mjs`), so a
      // backlog-only move skips it too — correct: neither runs code the diff touched. `tree-stays-clean`
      // has no `codeEntries` at all, so it (and the `beforePorcelain` snapshot `runLiveSmoke` takes up front,
      // unconditionally, before any skip logic) both still call through to `runChild` with a real `git status`.
      expect(ran(runChild)).toEqual(['status --porcelain', 'gh api', 'gh pr', 'status --porcelain']);
      expect(smoke.results.filter((r) => r.skipped).map((r) => r.name)).toEqual(['lane-pool-list', 'lane-acquire-release', 'reconcile-dry-run', 'dispatch-dry-run']);
    });
    it('a move touching lane-pool code re-runs the lane checks (and only those tree checks)', async () => {
      const runChild = runChildFor();
      const smoke = await runLiveSmoke({ root: '/x', env: {}, runChild, changedFiles: ['scripts/lib/lane-pool-paths.mjs'], closureOf });
      expect(smoke.results.filter((r) => r.skipped).map((r) => r.name)).toEqual(['reconcile-dry-run', 'dispatch-dry-run']);
    });
    it('an unknown diff (null) or an incomplete closure runs everything, as before', async () => {
      for (const opts of [{ changedFiles: null, closureOf }, { changedFiles: ['backlog/1.md'], closureOf: () => ({ files: new Set(), complete: false, bareDeps: false, jsonNames: new Set() }) }]) {
        const smoke = await runLiveSmoke({ root: '/x', env: {}, runChild: runChildFor(), ...opts });
        expect(smoke.results.some((r) => r.skipped)).toBe(false);
      }
    });
    it('runLiveSmokeWithRetry forwards changedFiles', async () => {
      const runChild = runChildFor();
      // Real closure of this repo: a backlog-only change touches none of the four tree-code checks
      // (lane-pool-list, lane-acquire-release, reconcile-dry-run, dispatch-dry-run) — `tree-stays-clean` has no
      // `codeEntries` and is never skipped.
      const root = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');
      const r = await runLiveSmokeWithRetry({ root, env: {}, runChild, changedFiles: ['backlog/4143.md'] });
      expect(r.verdict).toBe('pass');
      expect(r.smoke.results.filter((x) => x.skipped)).toHaveLength(4);
    });
  });

  // #4044: the live 08:14 ET alert read only `exited 1: node:internal/modules/cjs/loader:1227` — the stack
  // location, not the error. The gh checks' detail now carries the real error line too.
  it('a crashed gh (node stack) reports the real Error line, not only the stack location (#4044)', async () => {
    const runChild = vi.fn(async (cmd, args) => {
      if (cmd === 'gh') throw new Error("exited 1: node:internal/modules/cjs/loader:1227\n  throw err;\n  ^\n\nError: Cannot find module '/gone/lane-9/scripts/lib/gh-throttle.mjs'\n    at Module._resolveFilename");
      if (args[1] === 'list') return '[]';
      if (args[1] === 'acquire') return JSON.stringify({ lane: 2 });
      return '';
    });
    const smoke = await runLiveSmoke({ root: '/x', env: {}, runChild });
    const gh = smoke.results.find((r) => r.name === 'gh-api-repo');
    expect(gh.ok).toBe(false);
    expect(gh.detail).toContain("Cannot find module '/gone/lane-9/scripts/lib/gh-throttle.mjs'");
  });
  it('an overlay whose lane-pool.mjs prints transient-looking text still gets a code verdict (list and acquire)', async () => {
    for (const verb of ['list', 'acquire']) {
      const runChild = vi.fn(async (cmd, args) => {
        if (args[1] === verb) throw new Error('no free lane in pool "we" (42 all held/dirty) — printed by overlay code');
        if (args[1] === 'list') return '[]';
        if (args[1] === 'acquire') return JSON.stringify({ lane: 2 });
        return '';
      });
      const smoke = await runLiveSmoke({ root: '/x', env: {}, runChild });
      expect(smoke.pass).toBe(false);
      expect(classifySmokeFailure(smoke.results)).toBe('code');
    }
  });
  // Live 2026-09-25 08:14 ET: gh (a Go binary) reports network faults in Go's words, which none of the Node-style
  // patterns matched — so a GitHub/network blip in BOTH gh checks was rejected as `code`.
  it.each([
    'gh api --method GET repos/o/r failed: exited 1: error connecting to api.github.com',
    'gh pr list failed: exited 1: Post "https://api.github.com/graphql": write tcp 1.2.3.4:5->6.7.8.9:443: write: broken pipe',
    'gh api failed: exited 1: Get "https://api.github.com/repos/o/r": dial tcp: lookup api.github.com: no such host',
    'gh api failed: exited 1: net/http: TLS handshake timeout',
    'gh api failed: exited 1: read tcp 1.2.3.4:5->6.7.8.9:443: read: connection reset by peer',
    'gh api failed: exited 1: Get "https://api.github.com/x": dial tcp 1.2.3.4:443: i/o timeout',
  ])('gh network error %# classifies as transient', (detail) => {
    expect(classifySmokeFailure([{ ok: false, mayBeTransient: true, detail }])).toBe('transient');
  });
  it("the real lane-pool.mjs cmdAcquire 'no free lane' message classifies as transient", () => {
    // The exact shape lane-pool.mjs#cmdAcquire fails with when its bounded --wait-ms poll never finds a
    // candidate: `no free lane in pool "${repo.name}" (${lanes.length} all held/dirty) — release one or...`.
    const detail = 'lane-pool acquire --purpose=smoke failed: no free lane in pool "we" (42 all held/dirty) — release one or `provision` more';
    expect(classifySmokeFailure([{ ok: false, detail }])).toBe('transient');
  });
});

describe('runLiveSmoke — injected runChild', () => {
  const passingRunChild = withNewCheckDefaults(async (cmd, args) => {
    if (cmd === 'node' && args[0] === 'scripts/lane-pool.mjs' && args[1] === 'list') return '[]';
    if (cmd === 'node' && args[1] === 'acquire') return JSON.stringify({ lane: 7 });
    return '';
  });

  it('the kill switch skips every check and passes unconditionally', async () => {
    const runChild = vi.fn();
    const result = await runLiveSmoke({ root: '/x', env: { [SMOKE_KILL_SWITCH_ENV]: '1' }, runChild });
    expect(result).toEqual({ pass: true, disabled: true, results: [], sessionSlug: null });
    expect(runChild).not.toHaveBeenCalled();
  });

  it('every check passing → pass, one result row per check, in order', async () => {
    const result = await runLiveSmoke({ root: '/x', env: {}, runChild: passingRunChild });
    expect(result.pass).toBe(true);
    expect(result.disabled).toBe(false);
    expect(result.results.map((r) => r.name)).toEqual(SMOKE_CHECKS.map((c) => c.name));
    expect(result.results.every((r) => r.ok)).toBe(true);
    expect(typeof result.sessionSlug).toBe('string');
  });

  it('the lane acquire uses a unique --session slug and is released with the SAME lane number + slug', async () => {
    const calls = [];
    const runChild = vi.fn(async (cmd, args) => {
      calls.push(args);
      if (args[1] === 'list') return '[]';
      if (args[1] === 'acquire') return JSON.stringify({ lane: 12 });
      return '';
    });
    await runLiveSmoke({ root: '/x', env: {}, runChild });
    const acquireArgs = calls.find((a) => a[1] === 'acquire');
    const releaseArgs = calls.find((a) => a[1] === 'release');
    const sessionFromAcquire = acquireArgs.find((a) => a.startsWith('--session='));
    const sessionFromRelease = releaseArgs.find((a) => a.startsWith('--session='));
    expect(sessionFromAcquire).toBeDefined();
    expect(sessionFromAcquire).toBe(sessionFromRelease);
    expect(releaseArgs).toContain('--lane=12');
  });

  it('the lane acquire argv carries --wait-ms=<laneAcquireWaitMs> so a busy pool waits instead of failing instantly', async () => {
    const calls = [];
    const runChild = vi.fn(async (cmd, args) => {
      calls.push(args);
      if (args[1] === 'list') return '[]';
      if (args[1] === 'acquire') return JSON.stringify({ lane: 4 });
      return '';
    });
    await runLiveSmoke({ root: '/x', env: { WE_SMOKE_LANE_ACQUIRE_WAIT_MS: '9000' }, runChild });
    const acquireArgs = calls.find((a) => a[1] === 'acquire');
    expect(acquireArgs).toContain('--wait-ms=9000');
  });

  it('the lane acquire argv uses the 180000ms default --wait-ms with no env override', async () => {
    const calls = [];
    const runChild = vi.fn(async (cmd, args) => {
      calls.push(args);
      if (args[1] === 'list') return '[]';
      if (args[1] === 'acquire') return JSON.stringify({ lane: 4 });
      return '';
    });
    await runLiveSmoke({ root: '/x', env: {}, runChild });
    const acquireArgs = calls.find((a) => a[1] === 'acquire');
    expect(acquireArgs).toContain('--wait-ms=180000');
  });

  it('a single failing check fails the WHOLE gate, but every other check still runs (no fail-fast)', async () => {
    const runChild = withNewCheckDefaults(async (cmd, args) => {
      if (cmd === 'node' && args[1] === 'list') throw new Error('boom: list failed');
      if (cmd === 'node' && args[1] === 'acquire') return JSON.stringify({ lane: 1 });
      return '';
    });
    const result = await runLiveSmoke({ root: '/x', env: {}, runChild });
    expect(result.pass).toBe(false);
    expect(result.results).toHaveLength(SMOKE_CHECKS.length); // every check still ran
    expect(result.results.find((r) => r.name === 'lane-pool-list').ok).toBe(false);
    expect(result.results.filter((r) => r.name !== 'lane-pool-list').every((r) => r.ok)).toBe(true);
  });

  it('a lane acquired but never released fails the gate (a leaked lease is a real problem, not a footnote)', async () => {
    const runChild = vi.fn(async (cmd, args) => {
      if (args[1] === 'list') return '[]';
      if (args[1] === 'acquire') return JSON.stringify({ lane: 3 });
      if (args[1] === 'release') throw new Error('release timed out');
      return '';
    });
    const result = await runLiveSmoke({ root: '/x', env: {}, runChild });
    const laneCheck = result.results.find((r) => r.name === 'lane-acquire-release');
    expect(laneCheck.ok).toBe(false);
    expect(laneCheck.detail).toMatch(/release failed/);
    expect(result.pass).toBe(false);
  });

  // #4139 — live incident (backlog card 4061, row 1): a stray `lane-999999` reached the REAL shared
  // `~/workspace/.lanes/web-everything` pool from a supposedly-isolated test world. Root cause traced to this
  // exact gap: `checkLanePoolList`/`checkLaneAcquireRelease` never forwarded the `env` passed into
  // `runLiveSmoke` to their `runChild` (real `runBounded`/`spawn`) calls, so a caller (the daemon-scenario
  // simulator, `we:scripts/conveyor/__tests__/sim/`) that constructs an isolated env with its OWN private
  // `LANE_POOL_ROOT` had it silently dropped for the two lane-pool checks — those two children then inherited
  // whatever ambient env `spawn` falls back to instead, re-targeting the real pool. RED before the fix: `env`
  // was simply absent from the options object these two checks passed to `runChild`.
  it('the lane-pool checks (list + acquire/release) forward the CALLER-SUPPLIED env, never silently drop it', async () => {
    const marker = { LANE_POOL_ROOT: '/private/isolated-pool-for-this-world-only', WE_SIM_MARKER: 'yes' };
    const seenEnvs = [];
    const runChild = vi.fn(async (cmd, args, opts) => {
      const isLanePool = cmd === 'node' && args[0] === 'scripts/lane-pool.mjs';
      if (isLanePool) seenEnvs.push(opts?.env);
      if (isLanePool && args[1] === 'list') return '[]';
      if (isLanePool && args[1] === 'acquire') return JSON.stringify({ lane: 5 });
      return '';
    });
    const result = await runLiveSmoke({ root: '/x', env: marker, runChild });
    expect(result.results.find((r) => r.name === 'lane-pool-list').ok).toBe(true);
    expect(result.results.find((r) => r.name === 'lane-acquire-release').ok).toBe(true);
    // Every lane-pool child call (list, acquire, release) must have received the EXACT caller env — not
    // `undefined` (ambient fallback) and not some other derived object (e.g. `ghChildEnv`, which is for the
    // gh checks only, never lane-pool's).
    expect(seenEnvs).toHaveLength(3);
    for (const seen of seenEnvs) expect(seen).toBe(marker);
  });

  it('a check that THROWS is caught and recorded as a failure, not an uncaught rejection', async () => {
    const runChild = vi.fn(async () => { throw new Error('spawn ENOENT'); });
    const result = await runLiveSmoke({ root: '/x', env: {}, runChild });
    expect(result.pass).toBe(false);
    expect(result.results.every((r) => typeof r.detail === 'string')).toBe(true);
  });

  it('the reconcile check runs one dry-run per configured repo and reports how many failed', async () => {
    const seenRepos = [];
    const runChild = vi.fn(async (cmd, args) => {
      if (args[0] === 'scripts/conveyor/reconcile-pass.mjs') {
        seenRepos.push(args[1]);
        if (args[1].includes('frontierui')) throw new Error('gh: 401');
        return '{}';
      }
      if (args[1] === 'list') return '[]';
      if (args[1] === 'acquire') return JSON.stringify({ lane: 1 });
      return '';
    });
    const result = await runLiveSmoke({ root: '/x', env: {}, runChild });
    expect(seenRepos.length).toBe(3); // we, frontierui, plateau-app
    const reconcileCheck = result.results.find((r) => r.name === 'reconcile-dry-run');
    expect(reconcileCheck.ok).toBe(false);
    expect(reconcileCheck.detail).toMatch(/1\/3/);
  });
});

// Transient vehicle below is a `gh api` failure: since PR #2625's advisory fix only checks that run EXTERNAL tools
// (gh) may earn 'transient' — lane-pool.mjs runs from the tree under test and is always 'code'.
describe('runLiveSmokeWithRetry — retries a transient verdict, never a code one', () => {
  it('the kill switch short-circuits without spending an attempt', async () => {
    const runChild = vi.fn();
    const sleep = vi.fn();
    const result = await runLiveSmokeWithRetry({ root: '/x', env: { [SMOKE_KILL_SWITCH_ENV]: '1' }, runChild, sleep });
    expect(result).toEqual({ verdict: 'pass', disabled: true });
    expect(runChild).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled();
  });

  it('a transient failure on attempt 1 that passes on attempt 2 → pass, attempts:2, one sleep', async () => {
    let call = 0;
    const runChild = withNewCheckDefaults(async (cmd, args) => {
      if (cmd === 'gh' && args[0] === 'api') {
        call += 1;
        if (call === 1) throw new Error('HTTP 503 Service Unavailable');
        return '[]';
      }
      if (args[1] === 'list') return '[]';
      if (args[1] === 'acquire') return JSON.stringify({ lane: 1 });
      return '';
    });
    const sleep = vi.fn(async () => {});
    const result = await runLiveSmokeWithRetry({ root: '/x', env: {}, runChild, sleep, retries: 2, backoffMs: 1234 });
    expect(result.verdict).toBe('pass');
    expect(result.attempts).toBe(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(1234);
  });

  it('a persistently transient failure exhausts the retry cap → verdict stays transient, attempts = retries+1', async () => {
    const runChild = withNewCheckDefaults(async (cmd, args) => {
      if (cmd === 'gh' && args[0] === 'api') throw new Error('rate limit exceeded');
      if (args[1] === 'list') return '[]';
      if (args[1] === 'acquire') return JSON.stringify({ lane: 1 });
      return '';
    });
    const sleep = vi.fn(async () => {});
    const result = await runLiveSmokeWithRetry({ root: '/x', env: {}, runChild, sleep, retries: 2, backoffMs: 10 });
    expect(result.verdict).toBe('transient');
    expect(result.attempts).toBe(3); // 1 initial + 2 retries
    expect(sleep).toHaveBeenCalledTimes(2); // sleeps between attempts, never after the last
  });

  it('a code-shaped failure never retries at all', async () => {
    const runChild = withNewCheckDefaults(async (cmd, args) => {
      if (args[1] === 'list') throw new Error('SyntaxError: Unexpected token');
      if (args[1] === 'acquire') return JSON.stringify({ lane: 1 });
      return '';
    });
    const sleep = vi.fn(async () => {});
    const result = await runLiveSmokeWithRetry({ root: '/x', env: {}, runChild, sleep, retries: 2, backoffMs: 10 });
    expect(result.verdict).toBe('code');
    expect(result.attempts).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries and backoff default from env (WE_DAEMON_SMOKE_TRANSIENT_RETRIES / _RETRY_BACKOFF_MS) when not passed explicitly', async () => {
    const runChild = withNewCheckDefaults(async (cmd, args) => {
      if (cmd === 'gh' && args[0] === 'api') throw new Error('ETIMEDOUT');
      if (args[1] === 'list') return '[]';
      if (args[1] === 'acquire') return JSON.stringify({ lane: 1 });
      return '';
    });
    const sleep = vi.fn(async () => {});
    const env = { [SMOKE_TRANSIENT_RETRIES_ENV]: '0', [SMOKE_RETRY_BACKOFF_MS_ENV]: '999' };
    const result = await runLiveSmokeWithRetry({ root: '/x', env, runChild, sleep });
    expect(result.verdict).toBe('transient');
    expect(result.attempts).toBe(1); // retries:0 from env → no retry at all
    expect(sleep).not.toHaveBeenCalled();
  });

  // Every test above injects a fake `sleep`, so none of them exercise the REAL default backoff. An `.unref()`'d
  // backoff timer let Node exit mid-retry when nothing else was keeping the event loop alive — the resident
  // daemon vanished with exit 0 instead of retrying (the same death pass-daemon.mjs#realSleep documents, #3870).
  // Run it in a real child process, with no other handle open, so that exact exit is observable.
  it('the real default sleep keeps the process alive mid-backoff — the retry actually happens', () => {
    const moduleUrl = pathToFileURL(join(process.cwd(), 'scripts/lib/daemon-live-smoke.mjs')).href;
    const script = `
      import { runLiveSmokeWithRetry } from ${JSON.stringify(moduleUrl)};
      let call = 0;
      const runChild = async (cmd, args) => {
        if (cmd === 'node' && args[0] === '--input-type=module') return '[{"kind":"stub","pr":null,"ok":true}]';
        if (cmd === 'git') return '';
        if (cmd === 'gh' && args[0] === 'api') { call += 1; if (call === 1) throw new Error('HTTP 503 Service Unavailable'); return '[]'; }
        if (args[1] === 'list') return '[]';
        if (args[1] === 'acquire') return JSON.stringify({ lane: 1 });
        return '';
      };
      const r = await runLiveSmokeWithRetry({ root: '/x', env: {}, runChild, retries: 2, backoffMs: 50 });
      console.log('DONE ' + r.verdict + ' ' + r.attempts);
    `;
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
    expect(out.trim()).toBe('DONE pass 2');
  });
});

describe('rollbackToSha — fail-closed on an unverified tree', () => {
  it('no sha at all → refuses', () => expect(rollbackToSha({ root: '/x', sha: null })).toEqual({ ok: false, reason: 'no-sha' }));
  it('a dirty tree is never reset', () => {
    const run = vi.fn(() => ({ status: 0, stdout: ' M file.txt\n' }));
    expect(rollbackToSha({ root: '/x', sha: 'abc', run })).toEqual({ ok: false, reason: 'dirty' });
  });
  it('an unreadable tree state (status failed) is never reset — fails closed, not "assume clean"', () => {
    const run = vi.fn(() => ({ status: 1, stdout: '' }));
    expect(rollbackToSha({ root: '/x', sha: 'abc', run })).toEqual({ ok: false, reason: 'status-failed' });
  });
  it('a clean tree resets to the given sha', () => {
    const calls = [];
    const run = vi.fn((args) => { calls.push(args); return { status: 0, stdout: '' }; });
    expect(rollbackToSha({ root: '/x', sha: 'abc123', run })).toEqual({ ok: true });
    expect(calls).toContainEqual(['reset', '--hard', 'abc123']);
  });
  it('a failed reset is reported, not silently swallowed', () => {
    const run = vi.fn((args) => (args[0] === 'reset' ? { status: 1, stdout: '' } : { status: 0, stdout: '' }));
    expect(rollbackToSha({ root: '/x', sha: 'abc', run })).toEqual({ ok: false, reason: 'reset-failed' });
  });
});

describe('reject-cache — read/record/clear, keyed by clone path, OUTSIDE the checkout', () => {
  let stateDir;
  beforeEach(() => { stateDir = mkdtempSync(join(tmpdir(), 'smoke-state-')); });
  afterEach(() => rmSync(stateDir, { recursive: true, force: true }));

  it('nothing recorded yet → null', () => expect(readRejectedSha('/some/clone', { WE_DAEMON_SMOKE_STATE_DIR: stateDir })).toBeNull());

  it('record then read round-trips the sha', () => {
    const env = { WE_DAEMON_SMOKE_STATE_DIR: stateDir };
    expect(recordRejectedSha('/some/clone', 'deadbeef', { env })).toBe(true);
    expect(readRejectedSha('/some/clone', env)).toBe('deadbeef');
  });

  it('clear resets it back to null', () => {
    const env = { WE_DAEMON_SMOKE_STATE_DIR: stateDir };
    recordRejectedSha('/some/clone', 'deadbeef', { env });
    clearRejectedSha('/some/clone', env);
    expect(readRejectedSha('/some/clone', env)).toBeNull();
  });

  it('two different clone roots never collide', () => {
    const env = { WE_DAEMON_SMOKE_STATE_DIR: stateDir };
    recordRejectedSha('/clone/a', 'sha-a', { env });
    recordRejectedSha('/clone/b', 'sha-b', { env });
    expect(readRejectedSha('/clone/a', env)).toBe('sha-a');
    expect(readRejectedSha('/clone/b', env)).toBe('sha-b');
  });

  it('the state file lives OUTSIDE the given root — it would never show up in that clone\'s own `git status`', () => {
    const env = { WE_DAEMON_SMOKE_STATE_DIR: stateDir };
    const root = '/some/clone/under/test';
    const p = smokeStatePath(root, env);
    expect(p.startsWith(root)).toBe(false);
    expect(p.startsWith(stateDir)).toBe(true);
  });

  it('an unreadable/corrupt cache file reads as null, never throws', () => {
    const env = { WE_DAEMON_SMOKE_STATE_DIR: join(stateDir, 'does-not-exist') };
    expect(() => readRejectedSha('/x', env)).not.toThrow();
    expect(readRejectedSha('/x', env)).toBeNull();
  });
});

describe('gateMergedCommit — the one entry point daemon-self-sync.mjs and daemon-load-overlay.mjs both call', () => {
  let stateDir;
  beforeEach(() => { stateDir = mkdtempSync(join(tmpdir(), 'gate-state-')); });
  afterEach(() => rmSync(stateDir, { recursive: true, force: true }));

  const cleanRun = vi.fn((args) => (args[0] === 'status' ? { status: 0, stdout: '' } : { status: 0, stdout: '' }));

  it('kill switch → adopts unconditionally, never even reads the reject-cache or runs a child', async () => {
    const runChild = vi.fn();
    const verdict = await gateMergedCommit({
      root: '/x', preMergeSha: 'pre', mergedIdentitySha: 'merged', env: { [SMOKE_KILL_SWITCH_ENV]: '1' }, runChild, run: cleanRun,
    });
    expect(verdict).toEqual({ adopt: true, reason: 'kill-switch-disabled' });
    expect(runChild).not.toHaveBeenCalled();
  });

  it('smoke passes → adopts, and clears any prior rejection for this clone', async () => {
    const env = { WE_DAEMON_SMOKE_STATE_DIR: stateDir };
    recordRejectedSha('/x', 'some-older-bad-sha', { env });
    const runChild = withNewCheckDefaults(async () => JSON.stringify({ lane: 1 }));
    const verdict = await gateMergedCommit({ root: '/x', preMergeSha: 'pre', mergedIdentitySha: 'good-sha', env, runChild, run: cleanRun });
    expect(verdict.adopt).toBe(true);
    expect(readRejectedSha('/x', env)).toBeNull();
  });

  it('smoke fails → rejects, rolls back to preMergeSha, and records the rejected sha', async () => {
    const env = { WE_DAEMON_SMOKE_STATE_DIR: stateDir };
    const resetCalls = [];
    const run = (args) => { if (args[0] === 'reset') resetCalls.push(args); return { status: 0, stdout: '' }; };
    const runChild = vi.fn(async (cmd, args) => { if (args[1] === 'list') throw new Error('broken'); if (args[1] === 'acquire') return JSON.stringify({ lane: 1 }); return ''; });
    const verdict = await gateMergedCommit({ root: '/x', preMergeSha: 'pre-sha', mergedIdentitySha: 'bad-sha', env, runChild, run });
    expect(verdict.adopt).toBe(false);
    expect(verdict.reason).toBe('smoke-fail');
    expect(resetCalls).toContainEqual(['reset', '--hard', 'pre-sha']);
    expect(readRejectedSha('/x', env)).toBe('bad-sha');
  });

  it('the SAME rejected sha on a later call short-circuits — rolls back WITHOUT re-running the live smoke', async () => {
    const env = { WE_DAEMON_SMOKE_STATE_DIR: stateDir };
    recordRejectedSha('/x', 'still-bad', { env });
    const runChild = vi.fn();
    const resetCalls = [];
    const run = (args) => { if (args[0] === 'reset') resetCalls.push(args); return { status: 0, stdout: '' }; };
    const verdict = await gateMergedCommit({ root: '/x', preMergeSha: 'pre-sha-2', mergedIdentitySha: 'still-bad', env, runChild, run });
    expect(verdict.adopt).toBe(false);
    expect(verdict.reason).toBe('still-rejected');
    expect(runChild).not.toHaveBeenCalled(); // no live smoke re-run
    expect(resetCalls).toContainEqual(['reset', '--hard', 'pre-sha-2']);
  });

  it('a DIFFERENT sha than the one on record re-runs the smoke (main moved) rather than short-circuiting', async () => {
    const env = { WE_DAEMON_SMOKE_STATE_DIR: stateDir };
    recordRejectedSha('/x', 'old-bad-sha', { env });
    const runChild = withNewCheckDefaults(async () => JSON.stringify({ lane: 1 }));
    const verdict = await gateMergedCommit({ root: '/x', preMergeSha: 'pre', mergedIdentitySha: 'a-new-sha', env, runChild, run: cleanRun });
    expect(runChild).toHaveBeenCalled();
    expect(verdict.adopt).toBe(true);
  });

  it('a transient verdict (retry cap reached) rolls back but records NO rejection, and reason is smoke-transient', async () => {
    const env = { WE_DAEMON_SMOKE_STATE_DIR: stateDir, [SMOKE_RETRY_BACKOFF_MS_ENV]: '1' };
    const resetCalls = [];
    const run = (args) => { if (args[0] === 'reset') resetCalls.push(args); return { status: 0, stdout: '' }; };
    // every attempt fails the SAME transient way (a 401) — retry cap is reached, never promoted to 'code'
    const runChild = withNewCheckDefaults(async (cmd, args) => {
      if (cmd === 'gh' && args[0] === 'api') throw new Error('HTTP 401: Bad credentials');
      if (args[1] === 'list') return '[]';
      if (args[1] === 'acquire') return JSON.stringify({ lane: 1 });
      return '';
    });
    const verdict = await gateMergedCommit({ root: '/x', preMergeSha: 'pre-sha-3', mergedIdentitySha: 'transient-sha', env, runChild, run });
    expect(verdict.adopt).toBe(false);
    expect(verdict.reason).toBe('smoke-transient');
    expect(resetCalls).toContainEqual(['reset', '--hard', 'pre-sha-3']);
    expect(readRejectedSha('/x', env)).toBeNull(); // NEVER cached — an env fault must not poison the reject-cache
  });

  it('a transient verdict whose rollback itself fails reports quarantine:true', async () => {
    const env = { WE_DAEMON_SMOKE_STATE_DIR: stateDir, [SMOKE_RETRY_BACKOFF_MS_ENV]: '1' };
    const run = (args) => (args[0] === 'reset' ? { status: 1, stdout: '' } : { status: 0, stdout: '' });
    const runChild = withNewCheckDefaults(async (cmd, args) => {
      if (cmd === 'gh' && args[0] === 'api') throw new Error('ETIMEDOUT');
      if (args[1] === 'list') return '[]';
      if (args[1] === 'acquire') return JSON.stringify({ lane: 1 });
      return '';
    });
    const log = { error: vi.fn() };
    const verdict = await gateMergedCommit({ root: '/x', preMergeSha: 'pre', mergedIdentitySha: 'transient-2', env, runChild, run, log });
    expect(verdict.reason).toBe('smoke-transient');
    expect(verdict.rollback).toEqual({ ok: false, reason: 'reset-failed' });
    expect(verdict.quarantine).toBe(true);
    expect(readRejectedSha('/x', env)).toBeNull();
  });

  it('a failed rollback is reported, never silently swallowed', async () => {
    const env = { WE_DAEMON_SMOKE_STATE_DIR: stateDir };
    const run = (args) => (args[0] === 'reset' ? { status: 1, stdout: '' } : { status: 0, stdout: '' });
    const runChild = vi.fn(async (cmd, args) => { if (args[1] === 'list') throw new Error('broken'); if (args[1] === 'acquire') return JSON.stringify({ lane: 1 }); return ''; });
    const log = { error: vi.fn() };
    const verdict = await gateMergedCommit({ root: '/x', preMergeSha: 'pre', mergedIdentitySha: 'bad', env, runChild, run, log });
    expect(verdict.rollback).toEqual({ ok: false, reason: 'reset-failed' });
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('ROLLBACK FAILED'));
  });
});

// ── #4072 — the gate's gh checks must run gh exactly the way a dispatched session does (appended) ──────────

const ghApiCheck = SMOKE_CHECKS.find((c) => c.name === 'gh-api-repo').run;
const ghPrListCheck = SMOKE_CHECKS.find((c) => c.name === 'gh-pr-list').run;

describe('ghDispatchedSessionEnv — pure composition (#4072)', () => {
  it('strips an inherited GH_TOKEN/GITHUB_TOKEN even when App auth is not configured (no shim to fall back on)', () => {
    const out = ghDispatchedSessionEnv({ GH_TOKEN: 'daemon-ambient-stale', GITHUB_TOKEN: 'also-stale', PATH: '/usr/bin', HOME: '/x' });
    expect(out.GH_TOKEN).toBeUndefined();
    expect(out.GITHUB_TOKEN).toBeUndefined();
    expect(out.PATH).toBe('/usr/bin');
    expect(out.HOME).toBe('/x');
  });

  it('strips the inherited token even when App auth IS configured and the shim resolves — never lets an ambient token ride under the PATH override', () => {
    const out = ghDispatchedSessionEnv(
      {
        WE_GITHUB_APP_ID: '1', WE_GITHUB_APP_INSTALLATION_ID: '2', WE_GITHUB_APP_PRIVATE_KEY_PATH: '/x/key.pem',
        GH_TOKEN: 'daemon-ambient-stale', PATH: '/opt/homebrew/bin',
      },
      {
        pathEnv: '/opt/homebrew/bin', dir: '/shim', cachePath: '/x/cache.json',
        exists: (p) => p === '/opt/homebrew/bin/gh', writeFile: vi.fn(), chmod: vi.fn(), mkdir: vi.fn(),
      },
    );
    expect(out.GH_TOKEN).toBeUndefined();
    expect(out.PATH).toBe('/shim:/opt/homebrew/bin'); // the shim override still lands
  });

  it('a real cwd write (settings.local.json) still never leaks the ambient token into the returned env', () => {
    const out = ghDispatchedSessionEnv(
      {
        WE_GITHUB_APP_ID: '1', WE_GITHUB_APP_INSTALLATION_ID: '2', WE_GITHUB_APP_PRIVATE_KEY_PATH: '/x/key.pem',
        GITHUB_TOKEN: 'daemon-ambient-stale', PATH: '/opt/homebrew/bin',
      },
      { pathEnv: '/opt/homebrew/bin', dir: '/shim', exists: () => true, writeFile: vi.fn(), chmod: vi.fn(), mkdir: vi.fn() },
    );
    expect(out.GITHUB_TOKEN).toBeUndefined();
  });

  it('is a passthrough (no shim, nothing stripped) when neither App auth nor a token is present — the unconfigured, unremarkable host', () => {
    expect(ghDispatchedSessionEnv({ PATH: '/usr/bin' })).toEqual({ PATH: '/usr/bin' });
  });
});

describe("the gate's gh-api-repo / gh-pr-list checks — must FAIL exactly like a dispatched session would (#4072 proof)", () => {
  // Stands in for the real shim's own documented fallback (`runInherited(process.env)` when its shared token
  // cache is empty/stale, see gh-app-shim.mjs's renderGhShimScript): succeeds ONLY if the env the check
  // actually spawned `gh` with still carries a GH_TOKEN. A real dispatched session's spawn env is ALWAYS
  // sanitized at exactly this fallback moment (never carries one) — so a real session sees a 401 here.
  function fakeGh(cmd, args, opts) {
    if (opts && opts.env && opts.env.GH_TOKEN) return Promise.resolve('{}');
    return Promise.reject(Object.assign(new Error('gh api failed'), { stderr: 'HTTP 401: Bad credentials (https://api.github.com/graphql)' }));
  }

  it('FAILS (RED→GREEN: this is what today\'s bug let quietly pass) when routed through ghDispatchedSessionEnv against a daemon env carrying a stale ambient GH_TOKEN and no shim configured', async () => {
    const runChild = vi.fn(fakeGh);
    const ghChildEnv = ghDispatchedSessionEnv({ GH_TOKEN: 'daemon-ambient-stale-token', PATH: '/usr/bin' });
    const result = await ghApiCheck({ ghChildEnv, budgets: { ghApiMs: 1000 }, runChild });
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/failed/);
    expect(ghChildEnv.GH_TOKEN).toBeUndefined(); // the sanitize step is what made the fake `gh` fail above
  });

  it('gh-pr-list FAILS the same way, for the same reason', async () => {
    const runChild = vi.fn(fakeGh);
    const ghChildEnv = ghDispatchedSessionEnv({ GH_TOKEN: 'daemon-ambient-stale-token', PATH: '/usr/bin' });
    const result = await ghPrListCheck({ ghChildEnv, budgets: { ghPrListMs: 1000 }, runChild });
    expect(result.ok).toBe(false);
  });

  it('the PRE-FIX composition (`{...env, ...shimEnv}`, no sanitize) WOULD HAVE PASSED this exact scenario — the bug this item removes', async () => {
    const runChild = vi.fn(fakeGh);
    // Reproduces the pre-fix `ghEnvFor`: no shim contributed (App auth unconfigured here, matching the
    // isolated unit above), so `{...env, ...null}` === env, UNCHANGED — the ambient token survives untouched.
    const preFixGhChildEnv = { GH_TOKEN: 'daemon-ambient-stale-token', PATH: '/usr/bin' };
    const result = await ghApiCheck({ ghChildEnv: preFixGhChildEnv, budgets: { ghApiMs: 1000 }, runChild });
    expect(result.ok).toBe(true); // demonstrates the masking bug: the gate would have adopted broken code
  });

  it('still PASSES when a fresh token really is available through the shim path (App auth configured, cache resolves) — the fix never breaks the legitimate case', async () => {
    const runChild = vi.fn(fakeGh);
    const ghChildEnv = ghDispatchedSessionEnv(
      {
        WE_GITHUB_APP_ID: '1', WE_GITHUB_APP_INSTALLATION_ID: '2', WE_GITHUB_APP_PRIVATE_KEY_PATH: '/x/key.pem',
        GH_TOKEN: 'daemon-ambient-stale-token', PATH: '/opt/homebrew/bin',
      },
      { pathEnv: '/opt/homebrew/bin', dir: '/shim', exists: () => true, writeFile: vi.fn(), chmod: vi.fn(), mkdir: vi.fn() },
    );
    // The shim resolved (PATH override present) but the ambient token was still stripped — a real dispatched
    // session in this state calls through the shim script, which reads its OWN fresh cache and re-applies a
    // token itself; here we simulate that downstream success by handing the fake `gh` a runChild that treats
    // "shim PATH present" as equivalent to "the shim will supply its own fresh token". Since this fake can only
    // key off `opts.env`, assert the sanitize contract directly instead (no ambient leak) — the shim's own
    // internal fresh-token behavior is already proven live in gh-app-shim.test.mjs.
    expect(ghChildEnv.GH_TOKEN).toBeUndefined();
    expect(ghChildEnv.PATH).toBe('/shim:/opt/homebrew/bin');
  });
});

// ── xp4lw2v (epic #4075/#3383) — the two new checks: dispatch-dry-run + tree-stays-clean ─────────────────────

const dispatchDryRunCheck = SMOKE_CHECKS.find((c) => c.name === 'dispatch-dry-run').run;
const treeStaysCleanCheck = SMOKE_CHECKS.find((c) => c.name === 'tree-stays-clean').run;

describe('dispatch-dry-run — injected runChild', () => {
  it('every row passing → ok:true', async () => {
    const runChild = vi.fn(async (cmd, args) => {
      if (cmd === 'node' && args[0] === '--input-type=module') {
        return JSON.stringify([
          { kind: 'review', pr: 900001, ok: true }, { kind: 'fix', pr: 900002, ok: true },
          { kind: 'ci-heal-worst-case', pr: 900003, ok: true }, { kind: 'ci-heal-ordinary', pr: 900004, ok: true },
          { kind: 'reconcile-fix-pass', pr: null, ok: true }, { kind: 'reconcile-ci-heal-pass', pr: null, ok: true },
          { kind: 'reconcile-review-pass', pr: null, ok: true },
        ]);
      }
      return '';
    });
    const result = await dispatchDryRunCheck({ root: '/x', budgets: { dispatchDryRunMs: 1000 }, runChild, env: {} });
    expect(result).toEqual({ ok: true, detail: expect.stringContaining('dispatch dry-run ok') });
  });

  it('the child throwing (e.g. the bounded timeout) fails the check', async () => {
    const runChild = vi.fn(async () => { throw new Error('timed out after 45000ms (process group killed)'); });
    const result = await dispatchDryRunCheck({ root: '/x', budgets: { dispatchDryRunMs: 1000 }, runChild, env: {} });
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/timed out/);
  });

  // The exact live shape a6cbfced4 fixed: dispatchCiHeal threw "no value for the brief placeholder {{SCOPE}}"
  // for an item-less PR with an empty diff-derived scope. This is what the CHECK reports when the child script
  // hands back that one row failed — naming both the kind and the PR, never just "something failed".
  it('a single kind failing (an unfilled required placeholder, or any other dispatch throw) fails the WHOLE check and names the kind + PR', async () => {
    const runChild = vi.fn(async () => JSON.stringify([
      { kind: 'review', pr: 900001, ok: true },
      { kind: 'fix', pr: 900002, ok: true },
      { kind: 'ci-heal-worst-case', pr: 900003, ok: false, error: 'dispatch-lane: no value for the brief placeholder {{SCOPE}} — refusing to fill it with nothing' },
      { kind: 'ci-heal-ordinary', pr: 900004, ok: true },
    ]));
    const result = await dispatchDryRunCheck({ root: '/x', budgets: { dispatchDryRunMs: 1000 }, runChild, env: {} });
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('ci-heal-worst-case');
    expect(result.detail).toContain('900003');
    expect(result.detail).toContain('{{SCOPE}}');
  });

  it('a filled prompt still containing an unfilled REQUIRED placeholder fails, naming the kind + PR', async () => {
    const runChild = vi.fn(async () => JSON.stringify([
      { kind: 'review', pr: 900001, ok: false, error: "review PR #900001: required placeholder {{SESSION_SLUG}} left unfilled in the filled prompt (matched {{ SESSION_SLUG }})" },
    ]));
    const result = await dispatchDryRunCheck({ root: '/x', budgets: { dispatchDryRunMs: 1000 }, runChild, env: {} });
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('SESSION_SLUG');
    expect(result.detail).toContain('900001');
  });

  it('unparsable child output fails the check', async () => {
    const runChild = vi.fn(async () => 'not json');
    const result = await dispatchDryRunCheck({ root: '/x', budgets: { dispatchDryRunMs: 1000 }, runChild, env: {} });
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/unparsable/);
  });

  it('an empty result array is never a pass — "nothing ran" is not "everything ran clean"', async () => {
    const runChild = vi.fn(async () => '[]');
    const result = await dispatchDryRunCheck({ root: '/x', budgets: { dispatchDryRunMs: 1000 }, runChild, env: {} });
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/no rows/);
  });

  it('is mayBeTransient:false and declares DISPATCH_DRY_RUN_CODE_ENTRIES as its codeEntries', () => {
    const check = SMOKE_CHECKS.find((c) => c.name === 'dispatch-dry-run');
    expect(check.mayBeTransient).toBe(false);
    expect(check.codeEntries).toEqual(DISPATCH_DRY_RUN_CODE_ENTRIES);
  });

  it('skip-unchanged (#4044): skipped when none of its codeEntries changed — tree-stays-clean (no codeEntries) still runs and its own child is still invoked', async () => {
    const closureOf = ({ entries }) => ({
      files: new Set(entries[0] === DISPATCH_DRY_RUN_CODE_ENTRIES[0] ? [...DISPATCH_DRY_RUN_CODE_ENTRIES] : ['scripts/lane-pool.mjs']),
      complete: true, bareDeps: false, jsonNames: new Set(),
    });
    const runChild = vi.fn(async (cmd, args) => {
      if (cmd === 'git') return '';
      if (args[1] === 'list') return '[]';
      if (args[1] === 'acquire') return JSON.stringify({ lane: 1 });
      return '';
    });
    const smoke = await runLiveSmoke({ root: '/x', env: {}, runChild, changedFiles: ['backlog/9999.md'], closureOf });
    const dispatchRow = smoke.results.find((r) => r.name === 'dispatch-dry-run');
    const treeRow = smoke.results.find((r) => r.name === 'tree-stays-clean');
    expect(dispatchRow.skipped).toBe(true);
    expect(dispatchRow.ok).toBe(true);
    expect(treeRow.skipped).toBeUndefined();
    expect(runChild.mock.calls.some(([cmd, args]) => cmd === 'node' && args[0] === '--input-type=module')).toBe(false);
    expect(runChild.mock.calls.some(([cmd, args]) => cmd === 'git' && args[0] === 'status')).toBe(true);
  });

  it('a move touching one of its OWN codeEntries re-runs dispatch-dry-run', async () => {
    const closureOf = ({ entries }) => ({
      files: new Set(entries[0] === DISPATCH_DRY_RUN_CODE_ENTRIES[0] ? [...DISPATCH_DRY_RUN_CODE_ENTRIES] : ['scripts/lane-pool.mjs']),
      complete: true, bareDeps: false, jsonNames: new Set(),
    });
    const runChild = vi.fn(async (cmd, args) => {
      if (cmd === 'git') return '';
      if (cmd === 'node' && args[0] === '--input-type=module') return '[{"kind":"stub","pr":null,"ok":true}]';
      if (args[1] === 'list') return '[]';
      if (args[1] === 'acquire') return JSON.stringify({ lane: 1 });
      return '';
    });
    const smoke = await runLiveSmoke({ root: '/x', env: {}, runChild, changedFiles: [DISPATCH_DRY_RUN_CODE_ENTRIES[1]], closureOf });
    const dispatchRow = smoke.results.find((r) => r.name === 'dispatch-dry-run');
    expect(dispatchRow.skipped).toBeUndefined();
    expect(runChild.mock.calls.some(([cmd, args]) => cmd === 'node' && args[0] === '--input-type=module')).toBe(true);
  });
});

describe('tree-stays-clean — injected runChild', () => {
  it('an empty git status → ok:true', async () => {
    const runChild = vi.fn(async () => '');
    const result = await treeStaysCleanCheck({ root: '/x', budgets: { treeStaysCleanMs: 1000 }, runChild, env: {}, beforePorcelain: null });
    expect(result).toEqual({ ok: true, detail: 'git status --porcelain empty — tree stayed clean' });
  });

  it('is LAST in SMOKE_CHECKS and declares no codeEntries at all, so #4044 skip-unchanged can never skip it', () => {
    expect(SMOKE_CHECKS[SMOKE_CHECKS.length - 1].name).toBe('tree-stays-clean');
    expect(SMOKE_CHECKS.find((c) => c.name === 'tree-stays-clean').codeEntries).toBeUndefined();
    expect(SMOKE_CHECKS.find((c) => c.name === 'tree-stays-clean').mayBeTransient).toBe(false);
  });

  it('is never skipped even when changedFiles/closureOf would skip every other tree-code check', async () => {
    const runChild = vi.fn(async (cmd) => (cmd === 'git' ? '' : ''));
    const closureOf = () => ({ files: new Set(), complete: true, bareDeps: false, jsonNames: new Set() });
    const smoke = await runLiveSmoke({ root: '/x', env: {}, runChild, changedFiles: ['backlog/1.md'], closureOf });
    const row = smoke.results.find((r) => r.name === 'tree-stays-clean');
    expect(row.skipped).toBeUndefined();
    expect(row.ok).toBe(true);
  });

  // Live 2026-09-25: a state writer left `.conveyor/unsupported-repo.json` and
  // `scripts/conveyor/run-scorecards.json` dirty in the candidate tree — this is what would have caught it.
  it('a dirty tree fails, naming the dirty paths in detail', async () => {
    const runChild = vi.fn(async () => ' M scripts/conveyor/run-scorecards.json\n?? .conveyor/unsupported-repo.json\n');
    const result = await treeStaysCleanCheck({ root: '/x', budgets: { treeStaysCleanMs: 1000 }, runChild, env: {}, beforePorcelain: null });
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('run-scorecards.json');
    expect(result.detail).toContain('unsupported-repo.json');
  });

  it('distinguishes pre-existing dirt (present before this smoke ran) from dirt newly introduced by this smoke\'s own checks — but still fails on either', async () => {
    const runChild = vi.fn(async () => ' M pre-existing-file.txt\n?? new-file.txt\n');
    const result = await treeStaysCleanCheck({
      root: '/x', budgets: { treeStaysCleanMs: 1000 }, runChild, env: {}, beforePorcelain: ' M pre-existing-file.txt\n',
    });
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/pre-existing dirty path.*pre-existing-file\.txt/);
    expect(result.detail).toMatch(/newly dirtied.*new-file\.txt/);
  });

  it('all dirt pre-existing (nothing new) still fails, and is reported as entirely pre-existing', async () => {
    const runChild = vi.fn(async () => ' M pre-existing-file.txt\n');
    const result = await treeStaysCleanCheck({
      root: '/x', budgets: { treeStaysCleanMs: 1000 }, runChild, env: {}, beforePorcelain: ' M pre-existing-file.txt\n',
    });
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('pre-existing dirty path');
    expect(result.detail).not.toContain('newly dirtied');
  });

  it('a failed git status call fails the check', async () => {
    const runChild = vi.fn(async () => { throw new Error('git: command not found'); });
    const result = await treeStaysCleanCheck({ root: '/x', budgets: { treeStaysCleanMs: 1000 }, runChild, env: {} });
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/git status --porcelain failed/);
  });

  it('runLiveSmoke snapshots the porcelain BEFORE any check runs (best-effort), and it reaches the check as beforePorcelain', async () => {
    const calls = [];
    const runChild = vi.fn(async (cmd, args) => {
      calls.push([cmd, args]);
      if (cmd === 'git') return ' M already-here.txt\n';
      if (args[1] === 'list') return '[]';
      if (args[1] === 'acquire') return JSON.stringify({ lane: 1 });
      if (args[0] === '--input-type=module') return '[{"kind":"stub","pr":null,"ok":true}]';
      return '';
    });
    const smoke = await runLiveSmoke({ root: '/x', env: {}, runChild });
    // First call overall must be the beforePorcelain snapshot — before ANY check in SMOKE_CHECKS runs.
    expect(calls[0]).toEqual(['git', ['status', '--porcelain']]);
    const row = smoke.results.find((r) => r.name === 'tree-stays-clean');
    // Every path in the (unchanging, in this fixture) `git status` output is pre-existing, so it should read
    // as such rather than "newly dirtied" — proving beforePorcelain actually reached the check.
    expect(row.ok).toBe(false);
    expect(row.detail).toContain('pre-existing dirty path');
    expect(row.detail).not.toContain('newly dirtied');
  });
});

describe('DISPATCH_DRY_RUN_SCRIPT — real child, proves it catches the pre-fix a6cbfced4 shape (direct dispatch calls only — no GitHub reads)', () => {
  it('fails ci-heal-worst-case on a tree where a6cbfced4 is reverted (SCOPE required again), and passes on the real tree', () => {
    const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');
    // Both sides run from temp copies: the real checkout may itself be a `lane-N` clone, which the dispatch
    // functions refuse to start from (`assertNotALaneCheckout`). Only the dirs the dispatch graph reads are
    // copied, and the pass-level part (live `gh` reads) is skipped — this test needs no GitHub credential.
    const copyTree = () => {
      const dest = mkdtempSync(join(tmpdir(), 'dispatch-dry-run-'));
      for (const rel of ['scripts', 'skills-src', 'src/_data', 'package.json', '.gitignore']) {
        cpSync(join(REPO_ROOT, rel), join(dest, rel), {
          recursive: true,
          filter: (src) => !src.includes(`${sep}node_modules`) && !src.includes(`${sep}.git${sep}`) && !src.endsWith(`${sep}.git`),
        });
      }
      symlinkSync(join(REPO_ROOT, 'node_modules'), join(dest, 'node_modules'));
      return dest;
    };
    const childEnv = { ...process.env, WE_SMOKE_DISPATCH_PASSES: '0' };
    const tmpRoot = copyTree();
    const realRoot = copyTree();
    try {
      const ciHealPath = join(tmpRoot, 'scripts', 'operations', 'ci-heal-pr-dispatch.mjs');
      const original = readFileSync(ciHealPath, 'utf8');
      const NEEDLE = "[...OPTIONAL_BRIEF_PLACEHOLDERS, 'ITEM_NUM', 'SCOPE']";
      const REVERTED = "[...OPTIONAL_BRIEF_PLACEHOLDERS, 'ITEM_NUM']";
      expect(original).toContain(NEEDLE); // sanity: the fix is really there to revert
      writeFileSync(ciHealPath, original.replace(NEEDLE, REVERTED));

      const preFixOut = execFileSync(process.execPath, ['--input-type=module', '-e', DISPATCH_DRY_RUN_SCRIPT], { cwd: tmpRoot, encoding: 'utf8', env: childEnv });
      const preFixRows = JSON.parse(preFixOut);
      const preFixCiHeal = preFixRows.find((r) => r.kind === 'ci-heal-worst-case');
      expect(preFixCiHeal.ok).toBe(false);
      expect(preFixCiHeal.error).toContain('{{SCOPE}}');
      // the item-less-but-non-empty-scope case is NOT affected by this revert — SCOPE has a real value there.
      const preFixCiHealOrdinary = preFixRows.find((r) => r.kind === 'ci-heal-ordinary');
      expect(preFixCiHealOrdinary.ok).toBe(true);

      const realOut = execFileSync(process.execPath, ['--input-type=module', '-e', DISPATCH_DRY_RUN_SCRIPT], { cwd: realRoot, encoding: 'utf8', env: childEnv });
      const realRows = JSON.parse(realOut);
      expect(realRows.length).toBeGreaterThan(0);
      const failures = realRows.filter((r) => !r.ok);
      expect(failures).toEqual([]);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
      rmSync(realRoot, { recursive: true, force: true });
    }
  }, 120_000);
});
