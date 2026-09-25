/**
 * @file scripts/lib/daemon-live-smoke.mjs
 * @description #3383 — THE LIVE SMOKE GATE. `we:scripts/lib/daemon-self-sync.mjs#withSelfSync` merges
 *   `origin/main` into a daemon's dedicated clone and restarts the daemon onto it — historically UNCONDITIONALLY,
 *   the moment the merge lands, with no check that the merged code actually works. Operator, 2026-09-24: "didnt I
 *   say nothing get merge on daemon without being tested live and confirmed?" — a merged PR that day shipped a
 *   lane-pool regression this way and broke every review-daemon session (401s / lane crashes) because nothing
 *   ever ran the new code before the daemon restarted onto it.
 *
 * WHAT THIS FILE ADDS: a live smoke — real child processes, real lane-pool lease/release, a real `gh` read, a
 * real reconcile dry-run — run from the UPDATED tree, in the WINDOW `withSelfSync` already has between "merge
 * succeeded" and "restart onto it". {@link gateMergedCommit} is the one entry point both the daemon wrapper
 * (`daemon-self-sync.mjs`) and the operator's own manual CLI (`we:scripts/lib/daemon-load-overlay.mjs`) call —
 * SAME code path, so a hand-triggered early load is gated exactly like an automatic tick. Pass → adopt (the
 * caller restarts/keeps the merge). Fail → {@link rollbackToSha} (`git reset --hard` to the pre-merge HEAD,
 * allowed only because the clone is verified clean first — never resets a tree we could not confirm was safe to
 * discard) and the merged sha is recorded ({@link recordRejectedSha}) so the SAME broken sha is never
 * re-smoke-tested every tick until `origin/main` actually moves — {@link gateMergedCommit} short-circuits on a
 * repeat instead of re-running the (real, live-touching) checks.
 *
 * THE CHECKS ({@link SMOKE_CHECKS}), one list, one row per check — budgets read from env (see
 * {@link resolveSmokeBudgets}), never hard-coded twice:
 *   (a) `lane-pool.mjs list --acquirable --no-cache --limit=1` for the WE pool, then a REAL `acquire` of one
 *       lane (`--purpose=smoke`, a unique per-run session slug) and an immediate `release` — proves the pool
 *       machinery a dispatch would actually use still works, not just that the file parses.
 *   (b) one GitHub read the way a DISPATCHED session does it: through {@link ghDispatchedSessionEnv} — the
 *       calling process's own ambient `GH_TOKEN`/`GITHUB_TOKEN` stripped (`we:scripts/lib/gh-app-shim.mjs#sanitizeSpawnEnv`,
 *       #4072) THEN the gh App shim's `PATH` override folded on top (`#buildGhShimSettingsEnv` — opt-in,
 *       contributes nothing when the calling process hasn't configured App auth, in which case the check runs
 *       `gh` sanitized-but-unshimmed rather than skip) — `gh api --method GET repos/<repo>` plus `gh pr list
 *       --limit 1`. A 401 here is the gate WORKING: it means the merged code would have dispatched sessions
 *       that get the exact 401 real sessions saw 2026-09-24, and the gate keeps them off it instead of
 *       reporting it after the fact. #4072: BEFORE the sanitize step existed, this check ran with the RAW
 *       calling env, so the daemon's own continuously-refreshed `GH_TOKEN` rode along under the shim's PATH
 *       override and masked exactly the fallback failure real (properly-sanitized) dispatched sessions hit —
 *       the gate passed the same day every bot session got a real 401.
 *   (c) one `we:scripts/conveyor/reconcile-pass.mjs` dry-run per configured constellation repo (`we`,
 *       `frontierui`, `plateau-app` — {@link CONSTELLATION_REPOS}) — read-only (`runReconcilePass` only reads
 *       PRs/agents and plans; it dispatches nothing), run via its own CLI so it exercises the ACTUAL updated
 *       file on disk, not an in-process import of code that might itself be part of what broke.
 * Every check runs through `we:scripts/lib/bounded-child.mjs#runBounded` (spawned, detached, hard-timeout,
 * process-group-killed on timeout) so a hung child can never block a tick forever; every check is run (not
 * fail-fast) so one failure never hides the rest of the diagnostic picture, and the gate's overall verdict is
 * simply "did every check pass".
 *
 * KILL SWITCH: {@link SMOKE_KILL_SWITCH_ENV} (`WE_DAEMON_SMOKE_DISABLE=1`) — this is the ONE place in this
 * module that fails OPEN (adopt unconditionally) rather than closed, by explicit design: a kill switch that
 * itself refuses to work when something is already on fire is not a kill switch.
 *
 * PURE CORE / IO SHELL: {@link decideSmokeVerdict} is pure (given a results array, is the gate a pass?);
 * everything else here does real IO (child processes, fs reads for the reject-cache) through injectable
 * `runChild`/`run` params, same convention as `daemon-self-sync.mjs`'s own `run` injection.
 *
 * TRANSIENT vs. CODE (Module D, card 4041 follow-up) — {@link classifySmokeFailure} is the second, finer-grained
 * verdict on top of {@link decideSmokeVerdict}'s plain pass/fail: a FAILED check can still mean two very
 * different things, and treating them the same was itself a bug. A 401 from `gh`, a flaky 5xx, a DNS hiccup, or
 * a momentarily-exhausted lane pool (every worker lane busy for a few seconds under load) is an
 * ENVIRONMENT/INFRA fault that the OLD code would have hit exactly as hard as the NEW code — it says nothing
 * about whether the merged commit is safe. {@link recordRejectedSha}-ing a merge for a fault like that freezes
 * the daemon on a code-independent problem until a human notices and clears the cache by hand. So every failed
 * check's `detail` string is matched against {@link TRANSIENT_FAILURE_PATTERNS}; the verdict is `'transient'`
 * ONLY when every single failure matches — one genuine code-shaped failure (a thrown SyntaxError, an assertion
 * mismatch, anything not on the list) pulls the whole verdict to `'code'`, because a mix means at least one
 * failure IS evidence the merge broke something, and that must never be laundered through the transient path.
 * {@link runLiveSmokeWithRetry} is what actually uses the classification: on `'transient'` it retries the WHOLE
 * smoke (a fresh run, not just the failed check) up to a small RETRY CAP
 * (`WE_DAEMON_SMOKE_TRANSIENT_RETRIES`, default 2 — i.e. 3 attempts total) with a backoff between attempts
 * (`WE_DAEMON_SMOKE_RETRY_BACKOFF_MS`, default 15s), because most env noise (a rate limit, a busy pool) clears
 * within seconds. The cap exists so a GENUINELY down environment (origin unreachable for the whole window)
 * still gives up in bounded time rather than retrying forever; when the cap is reached the verdict stays
 * `'transient'` (never silently promoted to `'code'`) and {@link gateMergedCommit} rolls the clone back WITHOUT
 * writing a reject record — an env fault must never poison the reject-cache and permanently block a later,
 * healthy re-check of the SAME sha once the environment recovers.
 */

import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { runBounded, resolveChildTimeoutMs, resolveLaneAcquireTimeoutMs } from './bounded-child.mjs';
import { buildGhShimSettingsEnv, sanitizeSpawnEnv } from './gh-app-shim.mjs';
import { CONSTELLATION_REPOS } from './constellation-repos.mjs';
import { gitRun } from './main-staleness.mjs';

/** Set to `1`/`true`/`yes` to disable the whole gate — every merge is adopted unconditionally, exactly like
 *  before this file existed. The one intentionally fail-OPEN switch in this module. */
export const SMOKE_KILL_SWITCH_ENV = 'WE_DAEMON_SMOKE_DISABLE';

/** Is the gate disabled? */
export function isSmokeGateDisabled(env = process.env) {
  const v = String(env?.[SMOKE_KILL_SWITCH_ENV] ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Env var names for each check's budget override — see {@link resolveSmokeBudgets}. */
export const SMOKE_BUDGET_ENV = Object.freeze({
  lanePoolListMs: 'WE_SMOKE_LANE_POOL_LIST_MS',
  laneAcquireMs: 'WE_SMOKE_LANE_ACQUIRE_MS',
  laneReleaseMs: 'WE_SMOKE_LANE_RELEASE_MS',
  ghApiMs: 'WE_SMOKE_GH_API_MS',
  ghPrListMs: 'WE_SMOKE_GH_PR_LIST_MS',
  reconcileMs: 'WE_SMOKE_RECONCILE_MS',
  // #3383 Module D — how long the smoke's own `lane-pool.mjs acquire` may WAIT (`--wait-ms=`) for a busy pool
  // to free a lane, instead of failing instantly on a momentary flicker. See `checkLaneAcquireRelease`.
  laneAcquireWaitMs: 'WE_SMOKE_LANE_ACQUIRE_WAIT_MS',
});

function envMs(env, key, fallback) {
  const n = Number(env?.[key]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Non-negative integer env override (unlike {@link envMs}, `0` is a valid, meaningful value — e.g. "no
 *  retries"). Falls back on anything else (missing, negative, non-numeric). */
function envNonNegInt(env, key, fallback) {
  const n = Number(env?.[key]);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

/** Resolve every check's budget from env, falling back to a sane default (or to `bounded-child.mjs`'s own
 *  budgets, the single source for the generic/acquire timeouts). @returns {Record<string, number>} */
export function resolveSmokeBudgets(env = process.env) {
  return {
    lanePoolListMs: envMs(env, SMOKE_BUDGET_ENV.lanePoolListMs, resolveChildTimeoutMs(env)),
    laneAcquireMs: envMs(env, SMOKE_BUDGET_ENV.laneAcquireMs, resolveLaneAcquireTimeoutMs(env)),
    laneAcquireWaitMs: envMs(env, SMOKE_BUDGET_ENV.laneAcquireWaitMs, 180_000),
    laneReleaseMs: envMs(env, SMOKE_BUDGET_ENV.laneReleaseMs, resolveChildTimeoutMs(env)),
    ghApiMs: envMs(env, SMOKE_BUDGET_ENV.ghApiMs, 30_000),
    ghPrListMs: envMs(env, SMOKE_BUDGET_ENV.ghPrListMs, 30_000),
    reconcileMs: envMs(env, SMOKE_BUDGET_ENV.reconcileMs, 60_000),
  };
}

const firstLine = (e) => String((e && e.message) || e).split('\n')[0];

async function checkLanePoolList({ root, budgets, runChild }) {
  try {
    const out = await runChild('node', ['scripts/lane-pool.mjs', 'list', '--acquirable', '--no-cache', '--limit=1', '--json'], {
      cwd: root, timeoutMs: budgets.lanePoolListMs,
    });
    JSON.parse(out);
    return { ok: true, detail: 'lane-pool list --acquirable --no-cache --limit=1 ok' };
  } catch (e) {
    return { ok: false, detail: `lane-pool list --acquirable failed: ${firstLine(e)}` };
  }
}

async function checkLaneAcquireRelease({ root, budgets, sessionSlug, runChild }) {
  let laneNum = null;
  try {
    // #3383 Module D — `--wait-ms=<laneAcquireWaitMs>` lets a momentarily-exhausted pool (every lane busy for
    // a few seconds under real dispatch load) self-heal instead of failing the gate on the very first read;
    // `lane-pool.mjs`'s own `cmdAcquire` polls internally up to that bound before giving up with its "no free
    // lane" message (which is exactly what `TRANSIENT_FAILURE_PATTERNS` matches on when it still exhausts the
    // wait). The CHILD's own hard timeout must cover that whole wait plus the acquire's real clone/refresh
    // work, or `runBounded` kills the child before `--wait-ms` itself gets to time out — hence the `Math.max`
    // against the plain `laneAcquireMs` budget, with 60s of headroom on top.
    const acquireTimeoutMs = Math.max(budgets.laneAcquireMs, budgets.laneAcquireWaitMs + 60_000);
    const out = await runChild('node', [
      'scripts/lane-pool.mjs', 'acquire', '--purpose=smoke', `--session=${sessionSlug}`,
      `--wait-ms=${budgets.laneAcquireWaitMs}`, '--json',
    ], {
      cwd: root, timeoutMs: acquireTimeoutMs,
    });
    const parsed = JSON.parse(out);
    laneNum = Number.isInteger(parsed?.lane) ? parsed.lane : null;
    if (laneNum == null) return { ok: false, detail: 'lane-pool acquire returned no lane number' };
  } catch (e) {
    return { ok: false, detail: `lane-pool acquire --purpose=smoke failed: ${firstLine(e)}` };
  }
  try {
    await runChild('node', ['scripts/lane-pool.mjs', 'release', `--lane=${laneNum}`, `--session=${sessionSlug}`], {
      cwd: root, timeoutMs: budgets.laneReleaseMs,
    });
    return { ok: true, detail: `acquired + released lane-${laneNum}`, lane: laneNum };
  } catch (e) {
    // A stuck release still leaves a REAL lease held against the live pool — surfacing it as a gate failure
    // (never swallowed) is deliberate: a leaked smoke lease is exactly the kind of thing that should block
    // adopting the code that caused it, not just get logged and forgotten.
    return { ok: false, detail: `acquired lane-${laneNum} but release failed (lease leaked — needs a hand release): ${firstLine(e)}`, lane: laneNum };
  }
}

/**
 * Build the env the gate's gh checks run with — the SAME composition a real dispatched `claude --bg` session
 * gets (`we:scripts/operations/dispatch-lane-io.mjs#buildSpawnOptions`/`#resolveSettingsEnv`): the CALLING
 * process's own ambient `GH_TOKEN`/`GITHUB_TOKEN` stripped FIRST ({@link sanitizeSpawnEnv} — a dispatched
 * session never inherits its spawner's token), THEN the App shim's `PATH` override folded on top when App
 * auth is configured ({@link buildGhShimSettingsEnv} — the same `--settings` env object a dispatcher hands the
 * session).
 *
 * #4072, live-caught 2026-09-24: the PRE-FIX gate instead did `{...env, ...shimEnv}` — the shim override
 * merged onto the RAW, un-sanitized env. `github-app-auth-env.mjs#ensureFreshGithubAppEnv` keeps `GH_TOKEN`
 * set and CONTINUOUSLY FRESH on the daemon's own long-running process (needed for the daemon's own gh/git
 * calls) — so that ambient token rode along underneath the PATH override every time this gate ran. The
 * generated shim script ignores an inherited `GH_TOKEN` while its OWN shared token cache is fresh, but FALLS
 * BACK to whatever `GH_TOKEN` it was invoked with (`runInherited(process.env)`) the moment that shared cache
 * is empty or stale — precisely the moment a REAL dispatched session (whose spawn env is ALWAYS sanitized,
 * never carrying the daemon's token at all) instead falls back to no token and gets a real 401. The gate's own
 * `gh` checks quietly rode the daemon's always-fresh fallback and passed, every time, while bot sessions with
 * no such fallback failed — sanitizing here first closes that gap: the gate's checks can no longer pass on a
 * fallback a dispatched session could never reach.
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{pathEnv?:string, exists?:Function, writeFile?:Function, chmod?:Function, mkdir?:Function,
 *   readFile?:Function, cachePath?:string, dir?:string, cwd?:string}} [shimOpts] forwarded to
 *   {@link buildGhShimSettingsEnv} — test injection only; production callers pass none (real fs, real PATH).
 * @returns {NodeJS.ProcessEnv}
 */
export function ghDispatchedSessionEnv(env = process.env, shimOpts = {}) {
  const sanitized = sanitizeSpawnEnv(env);
  const shimEnv = buildGhShimSettingsEnv({ env, ...shimOpts });
  return shimEnv ? { ...sanitized, ...shimEnv } : sanitized;
}

async function checkGhApiRepo({ ghChildEnv, budgets, runChild }) {
  const slug = CONSTELLATION_REPOS.we.slug;
  try {
    await runChild('gh', ['api', '--method', 'GET', `repos/${slug}`], { env: ghChildEnv, timeoutMs: budgets.ghApiMs });
    return { ok: true, detail: `gh api --method GET repos/${slug} ok` };
  } catch (e) {
    return { ok: false, detail: `gh api --method GET repos/${slug} failed: ${firstLine(e)}` };
  }
}

async function checkGhPrList({ ghChildEnv, budgets, runChild }) {
  const slug = CONSTELLATION_REPOS.we.slug;
  try {
    await runChild('gh', ['pr', 'list', '--limit', '1', '--repo', slug, '--json', 'number'], { env: ghChildEnv, timeoutMs: budgets.ghPrListMs });
    return { ok: true, detail: `gh pr list --repo ${slug} --limit 1 ok` };
  } catch (e) {
    return { ok: false, detail: `gh pr list --repo ${slug} --limit 1 failed: ${firstLine(e)}` };
  }
}

async function checkReconcileDryRun({ root, repos, budgets, runChild }) {
  const failures = [];
  for (const slug of repos) {
    try {
      await runChild('node', ['scripts/conveyor/reconcile-pass.mjs', `--repo=${slug}`, '--json'], { cwd: root, timeoutMs: budgets.reconcileMs });
    } catch (e) {
      failures.push(`${slug}: ${firstLine(e)}`);
    }
  }
  if (failures.length) {
    return { ok: false, detail: `reconcile-pass dry-run failed for ${failures.length}/${repos.length} repo(s): ${failures.join('; ')}` };
  }
  return { ok: true, detail: `reconcile-pass dry-run ok for ${repos.length} repo(s)` };
}

/** THE ONE LIST — every live check the gate runs, in order. Each `run(ctx)` gets `{ root, budgets, repos,
 *  sessionSlug, ghChildEnv, runChild }` and must never throw (a throw is still caught by {@link runLiveSmoke},
 *  but a check should report `{ ok:false, detail }` itself so the detail is specific). */
// `mayBeTransient:false` — a failure of this check is ALWAYS `'code'` ({@link classifySmokeFailure}), whatever its
// text says. `reconcile-dry-run` runs `reconcile-pass.mjs` FROM THE TREE UNDER TEST, and anything that script prints
// flows into `detail`; if its text could buy a `'transient'` verdict, a broken overlay could print one of
// {@link TRANSIENT_FAILURE_PATTERNS} and dodge the reject record every tick. The lane-pool rows also run code from
// the tree, but they stay eligible: a momentarily exhausted pool is the transient case Module D exists for.
// Cost, accepted: a real gh/network blip inside the reconcile dry-run now records a rejection too (as every
// failure did before Module D); it clears as soon as main or the overlay inputs move.
export const SMOKE_CHECKS = Object.freeze([
  { name: 'lane-pool-list', run: checkLanePoolList, mayBeTransient: true },
  { name: 'lane-acquire-release', run: checkLaneAcquireRelease, mayBeTransient: true },
  { name: 'gh-api-repo', run: checkGhApiRepo, mayBeTransient: true },
  { name: 'gh-pr-list', run: checkGhPrList, mayBeTransient: true },
  { name: 'reconcile-dry-run', run: checkReconcileDryRun, mayBeTransient: false },
]);

/** PURE: does a completed set of check results pass the gate? Every single check must have passed. */
export function decideSmokeVerdict(results) {
  return results.length > 0 && results.every((r) => r.ok);
}

/**
 * Run every {@link SMOKE_CHECKS} row against `root` (the clone that just merged new code) and report a verdict.
 * Never throws — a check that throws is caught and recorded as a failure, exactly like an explicit `{ok:false}`.
 * @param {{root:string, env?:NodeJS.ProcessEnv, repos?:string[], runChild?:typeof runBounded, now?:number}} o
 * @returns {Promise<{pass:boolean, disabled:boolean, results:Array<object>, sessionSlug:string}>}
 */
export async function runLiveSmoke({
  root, env = process.env, repos = Object.values(CONSTELLATION_REPOS).map((r) => r.slug),
  runChild = runBounded, now = Date.now(),
} = {}) {
  if (isSmokeGateDisabled(env)) return { pass: true, disabled: true, results: [], sessionSlug: null };
  const budgets = resolveSmokeBudgets(env);
  const sessionSlug = `smoke-${now}-${randomUUID().slice(0, 8)}`;
  const ghChildEnv = ghDispatchedSessionEnv(env);
  const ctx = { root, budgets, repos, sessionSlug, ghChildEnv, runChild };
  const results = [];
  for (const check of SMOKE_CHECKS) {
    const startedAt = Date.now();
    let result;
    try {
      result = await check.run(ctx);
    } catch (e) {
      result = { ok: false, detail: `threw: ${firstLine(e)}` };
    }
    results.push({ name: check.name, ms: Date.now() - startedAt, ...result, mayBeTransient: check.mayBeTransient !== false });
  }
  return { pass: decideSmokeVerdict(results), disabled: false, results, sessionSlug };
}

// ── Transient vs. code classification (Module D) — see the file header for the full rationale. ──

/** Env/infra fault signatures a failed check's `detail` is matched against — see {@link classifySmokeFailure}.
 *  Frozen and exported so a caller/test can see exactly what counts as "environment noise, not code" without
 *  re-deriving it. Kept as one pattern per alternative (rather than one combined regex) so a single culprit
 *  substring is easy to spot/extend without fighting regex precedence. */
export const TRANSIENT_FAILURE_PATTERNS = Object.freeze([
  /\b401\b/i,
  /Bad credentials/i,
  /HTTP 5\d\d/i,
  /rate limit/i,
  /ETIMEDOUT/i,
  /ECONNRESET/i,
  /ENOTFOUND/i,
  /EAI_AGAIN/i,
  // `bounded-child.mjs#runBounded`'s OWN hard-timeout rejection: the WHOLE detail must be `<check prefix> failed:
  // timed out after Nms (process group killed)`, anchored at both ends (no check prefix contains a `:`).
  // NOT a bare /timeout|timed out/: those match ordinary code-failure text ("timed out waiting for #submit",
  // an assertion naming a `timeout` option) and would launder a real regression through the retry path. A child
  // that merely PRINTS this text reaches `detail` as `<prefix> failed: exited N: …`, so it cannot match.
  /^[^:]+ failed: timed out after \d+ms \(process group killed\)$/,
  /no free lane/i, // lane-pool.mjs#cmdAcquire's exhausted-pool message, e.g. `no free lane in pool "we" (12 all held/dirty) — release one or \`provision\` more`
  /all lanes (are )?busy/i,
  /pool (is )?(full|exhausted)/i,
  /could not resolve host/i,
]);

function isTransientDetail(detail) {
  const s = String(detail ?? '');
  return TRANSIENT_FAILURE_PATTERNS.some((re) => re.test(s));
}

/**
 * PURE: classify a completed {@link runLiveSmoke} `results` array as one of:
 *  - `'pass'` — every check ok.
 *  - `'transient'` — at least one check failed, and EVERY failure's `detail` matches
 *    {@link TRANSIENT_FAILURE_PATTERNS} (an auth/network/pool-capacity fault the old code would hit identically)
 *    AND came from a check that may be transient (a row with `mayBeTransient:false` — see {@link SMOKE_CHECKS} —
 *    always counts as code; a row without the field is eligible).
 *  - `'code'` — at least one failure does NOT match (a genuinely code-shaped failure), OR no checks ran at all
 *    (an empty result set is never "just env noise" — same fail-closed posture as {@link decideSmokeVerdict}).
 * A single non-transient failure pulls the WHOLE verdict to `'code'`: a mix of one real bug and one flaky 401
 * is still a real bug, and must never be laundered through the transient/retry path.
 * @param {Array<{ok:boolean, detail?:string}>} results
 * @returns {'pass'|'transient'|'code'}
 */
export function classifySmokeFailure(results) {
  if (!Array.isArray(results) || results.length === 0) return 'code';
  const failures = results.filter((r) => !r.ok);
  if (failures.length === 0) return 'pass';
  return failures.every((r) => r.mayBeTransient !== false && isTransientDetail(r.detail)) ? 'transient' : 'code';
}

/** Default retry cap for {@link runLiveSmokeWithRetry} — the number of EXTRA attempts after the first, once a
 *  run classifies as `'transient'`. Overridable via `WE_DAEMON_SMOKE_TRANSIENT_RETRIES` (`0` is a valid,
 *  meaningful override: "never retry, one shot"). */
export const SMOKE_TRANSIENT_RETRIES_ENV = 'WE_DAEMON_SMOKE_TRANSIENT_RETRIES';
/** Default sleep between retries — env `WE_DAEMON_SMOKE_RETRY_BACKOFF_MS`. Most env noise (a rate limit, a
 *  momentarily-full lane pool) clears within seconds; 15s gives it real room without dragging a rebuild out. */
export const SMOKE_RETRY_BACKOFF_MS_ENV = 'WE_DAEMON_SMOKE_RETRY_BACKOFF_MS';

// Deliberately NOT `.unref()`'d: the backoff IS the work in flight. With nothing else ref'd (the write-lock
// heartbeat is unref'd, the failed attempt's child calls are done), an unref'd timer lets Node exit before it
// fires — the retry never happens and the resident daemon dies with exit 0 (the #3870 death that
// pass-daemon.mjs#realSleep documents).
const defaultSleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * Run {@link runLiveSmoke} and, on a `'transient'` verdict ONLY (see {@link classifySmokeFailure}), retry the
 * WHOLE smoke (never just the failed check — the checks share live state like a lane lease) up to `retries`
 * more times, sleeping `backoffMs` between attempts. A `'code'` verdict never retries — it is a real finding,
 * not noise. The kill switch is checked up front and short-circuits identically to {@link runLiveSmoke}'s own
 * kill-switch path, without spending an attempt.
 * @param {{root:string, env?:NodeJS.ProcessEnv, runChild?:typeof runBounded, sleep?:(ms:number)=>Promise<void>,
 *   retries?:number, backoffMs?:number}} o
 * @returns {Promise<{verdict:'pass'|'transient'|'code', attempts?:number, smoke?:object, disabled?:boolean}>}
 */
export async function runLiveSmokeWithRetry({
  root, env = process.env, runChild = runBounded, sleep = defaultSleep,
  retries = envNonNegInt(env, SMOKE_TRANSIENT_RETRIES_ENV, 2),
  backoffMs = envMs(env, SMOKE_RETRY_BACKOFF_MS_ENV, 15_000),
} = {}) {
  if (isSmokeGateDisabled(env)) return { verdict: 'pass', disabled: true };
  let smoke;
  let verdict;
  let attempts = 0;
  for (;;) {
    attempts += 1;
    smoke = await runLiveSmoke({ root, env, runChild });
    verdict = classifySmokeFailure(smoke.results);
    if (verdict !== 'transient' || attempts > retries) break;
    await sleep(backoffMs);
  }
  return { verdict, attempts, smoke };
}

// ── Reject-cache: remember the last merged sha the gate rejected, so a daemon never re-runs the (real,
// live-touching) smoke against the SAME known-bad `origin/main` every single tick until it actually moves. ──

/** Where the per-clone reject-cache lives — deliberately OUTSIDE any git checkout: a file inside `root` would
 *  show up in `git status --porcelain` and read as permanently dirty, which would make
 *  `we:scripts/lib/daemon-self-sync.mjs#decideSelfSync` fail closed (`dirty`) forever, blocking every FUTURE
 *  self-sync too. Keyed by a short hash of the checkout's own absolute path so multiple clones never collide;
 *  overridable via env for tests / a non-default machine layout. */
export const SMOKE_STATE_DIR_ENV = 'WE_DAEMON_SMOKE_STATE_DIR';

export function smokeStateDir(env = process.env) {
  return env?.[SMOKE_STATE_DIR_ENV] || join(homedir(), '.claude', 'daemon-self-sync-state');
}

export function smokeStatePath(root, env = process.env) {
  const key = createHash('sha256').update(String(root)).digest('hex').slice(0, 16);
  return join(smokeStateDir(env), `${key}.json`);
}

/** The sha the gate last rejected for this clone, or `null` (none on record, or the cache is unreadable —
 *  fails to "no cached rejection", i.e. the gate re-tests, never to a false short-circuit). */
export function readRejectedSha(root, env = process.env) {
  try {
    const parsed = JSON.parse(readFileSync(smokeStatePath(root, env), 'utf8'));
    return typeof parsed?.rejectedSha === 'string' && parsed.rejectedSha ? parsed.rejectedSha : null;
  } catch {
    return null;
  }
}

/** Best-effort write; a failure to record never blocks the caller (worst case: the next tick re-tests the same
 *  sha instead of short-circuiting — extra live-touch, never a correctness problem). */
export function recordRejectedSha(root, sha, { env = process.env, reason = '', at = new Date().toISOString() } = {}) {
  try {
    mkdirSync(smokeStateDir(env), { recursive: true });
    writeFileSync(smokeStatePath(root, env), JSON.stringify({ rejectedSha: sha, reason, at }, null, 2));
    return true;
  } catch {
    return false;
  }
}

export function clearRejectedSha(root, env = process.env) {
  try {
    mkdirSync(smokeStateDir(env), { recursive: true });
    writeFileSync(smokeStatePath(root, env), JSON.stringify({ rejectedSha: null }, null, 2));
    return true;
  } catch {
    return false;
  }
}

/**
 * Roll a clone back to `sha` — ALLOWED ONLY because the tree is verified clean first (a `git status --porcelain`
 * that fails, times out, or reports dirt fails CLOSED: never reset a tree we could not confirm was safe to
 * discard). Mirrors `daemon-self-sync.mjs#decideSelfSync`'s own fail-closed posture on an unreadable tree state.
 * @param {{root:string, sha:string|null, run?:typeof gitRun}} o
 * @returns {{ok:boolean, reason?:string}}
 */
export function rollbackToSha({ root, sha, run = gitRun }) {
  if (!sha) return { ok: false, reason: 'no-sha' };
  const status = run(['status', '--porcelain'], { cwd: root, timeout: 60_000, killSignal: 'SIGKILL' });
  const dirty = status.status === 0 ? !!String(status.stdout ?? '').trim() : null;
  if (dirty !== false) return { ok: false, reason: dirty === null ? 'status-failed' : 'dirty' };
  const reset = run(['reset', '--hard', sha], { cwd: root, timeout: 60_000, killSignal: 'SIGKILL' });
  if (reset.status !== 0) return { ok: false, reason: 'reset-failed' };
  return { ok: true };
}

/**
 * THE ONE GATE both `daemon-self-sync.mjs#withSelfSync` and `daemon-load-overlay.mjs` call, right after a merge
 * has already landed on disk. Decides adopt vs. roll back, and does whichever effect that implies.
 *
 * Kept for back-compat (the module-level rebuild flow — Module C — calls {@link runLiveSmokeWithRetry}
 * directly instead) but upgraded to use it internally: a `'transient'` verdict (see {@link
 * classifySmokeFailure}) rolls back WITHOUT writing a reject record and returns `reason:'smoke-transient'`,
 * distinct from `reason:'smoke-fail'` (a genuine `'code'` verdict, which DOES record the rejection). Either
 * way, a rollback that itself fails sets `quarantine:true` on the result (the clone is left on unknown code and
 * needs a hand `git reset --hard`) in addition to `rollback:{ok:false, reason}`.
 * @param {{root:string, preMergeSha:string|null, mergedIdentitySha?:string|null, env?:NodeJS.ProcessEnv,
 *   runChild?:typeof runBounded, run?:typeof gitRun, log?:Console}} o
 * @returns {Promise<{adopt:boolean, reason:'kill-switch-disabled'|'still-rejected'|'smoke-pass'|
 *   'smoke-transient'|'smoke-fail', smoke?:object, rollback?:object, quarantine?:true}>}
 */
export async function gateMergedCommit({
  root, preMergeSha, mergedIdentitySha = null, env = process.env, runChild = runBounded, run = gitRun, log = console,
}) {
  if (isSmokeGateDisabled(env)) return { adopt: true, reason: 'kill-switch-disabled' };

  const priorRejected = readRejectedSha(root, env);
  if (mergedIdentitySha && priorRejected && mergedIdentitySha === priorRejected) {
    const rollback = rollbackToSha({ root, sha: preMergeSha, run });
    log.error?.(
      `daemon-live-smoke: origin/main is still the previously-rejected ${mergedIdentitySha} — NOT re-running the live smoke `
      + `(#3383, retried-until-main-moves guard); ${rollback.ok ? 'rolled back' : `ROLLBACK FAILED (${rollback.reason}) — clone may be left on the rejected code, needs a hand \`git reset --hard ${preMergeSha}\``}`,
    );
    return { adopt: false, reason: 'still-rejected', rollback };
  }

  // #3383 Module D — retry-on-transient (classifySmokeFailure) wraps the single runLiveSmoke call below.
  const { verdict, smoke, disabled } = await runLiveSmokeWithRetry({ root, env, runChild });
  if (verdict === 'pass') {
    if (mergedIdentitySha) clearRejectedSha(root, env);
    return { adopt: true, reason: disabled ? 'kill-switch-disabled' : 'smoke-pass', smoke };
  }

  if (verdict === 'transient') {
    // Env/infra noise (a 401, a busy lane pool, a network blip) survived every retry — roll back so the
    // daemon never restarts onto un-vetted code, but NEVER write a reject record: caching a transient fault
    // would permanently block a later, healthy re-check of this SAME sha once the environment recovers (the
    // exact freeze #3383's rationale exists to prevent).
    const rollback = rollbackToSha({ root, sha: preMergeSha, run });
    log.error?.(
      `daemon-live-smoke: TRANSIENT live smoke failure (env/infra noise, not recording a rejection — #3383 Module D) `
      + `after retry; ${rollback.ok ? `rolled back to ${preMergeSha}` : `ROLLBACK FAILED (${rollback.reason}) — clone may be left mid-move, needs a hand \`git reset --hard ${preMergeSha}\``}`,
    );
    const result = { adopt: false, reason: 'smoke-transient', smoke, rollback };
    if (!rollback.ok) result.quarantine = true;
    return result;
  }

  const failedNames = smoke.results.filter((r) => !r.ok).map((r) => r.name);
  const rollback = rollbackToSha({ root, sha: preMergeSha, run });
  if (mergedIdentitySha) recordRejectedSha(root, mergedIdentitySha, { env, reason: failedNames.join(',') });
  log.error?.(
    `daemon-live-smoke: REJECTED merged commit(s) — live smoke failed (${failedNames.join(', ') || 'no checks ran'}); `
    + `${rollback.ok ? `rolled back to ${preMergeSha}` : `ROLLBACK FAILED (${rollback.reason}) — clone may be left on BROKEN code, needs a hand \`git reset --hard ${preMergeSha}\``}`,
  );
  return { adopt: false, reason: 'smoke-fail', smoke, rollback };
}
