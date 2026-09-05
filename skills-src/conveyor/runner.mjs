#!/usr/bin/env node
/**
 * @file skills-src/conveyor/runner.mjs
 * @description The conveyor HEADLESS RUNNER (WE #2702, epic #2677(b), the DELEGATE half) — a SINGLETON-LOCKED,
 *   no-LLM runner that drives the mechanized tick core ({@link ../../scripts/conveyor/tick-core.mjs}, #2699)
 *   for the conveyor. It reads state and STEPS the tested state machine — it spends NO model context per tick
 *   (memory rule / #2701 clause 1): every guard, TTL, re-dispatch gate, watcher-arm, and idle-stop decision is
 *   the tick core's, applied deterministically; the runner is a THIN SHELL that threads the core's `nextState`
 *   into the next tick UNCHANGED and SURFACES the tick's decisions. It never re-derives a guard rule.
 *
 * WHAT #2701 SETTLES (the ratified mechanics-not-agent boundary, codified at
 *   [we:docs/agent/platform-decisions.md#conveyor-orchestration-mechanics-not-per-lane-agent]):
 *   1. The per-lane driver is a headless runner over the tested tick-core state machine — no per-tick model
 *      context. THIS file is that runner.
 *   2. NO per-lane conducting agent (Option B rejected) — so this is ONE singleton-locked runner, not an
 *      always-on LLM conductor per lane. The singleton right is held by {@link ./runner-lock.mjs}.
 *   3. A single supervisor is deferred (Option C) and genuine NOVELTY escalates to the main-session judgment
 *      layer — the runner never improvises a ruling. So the runner EMITS its dispatch/watch decisions
 *      ({@link tickSurface}) for the judgment layer to execute; it does not itself spawn LLM delivery agents.
 *
 * SCOPE (#2702, NOT #2703): this builds the runner MECHANISM — the singleton lock + the loop that steps the
 *   core, carries bookkeeping, runs the deterministic no-LLM passes (infra-blocked recovery §4b, lease-reaper
 *   §4c, session-reaper §4d, the reconcile-fix dispatch pass #3438), and surfaces the tick. It does NOT retire
 *   the main-session serial loop (that is #2703, blocked on this) and does NOT wire headless LLM agent-spawning
 *   (the CLI agent-runner backend,
 *   [#agent-runner-cli-backend]) — both belong to the retirement slice. The guard SEMANTICS are PRESERVED
 *   verbatim: they live in the tick core; the runner alters none of them.
 *
 * PURE-CORE / IO-SHELL SPLIT (the hard design constraint, mirrored from tick-core.mjs):
 *   • The PURE core ({@link carryForward}, {@link shouldStop}, {@link tickSurface}, {@link runLoop}) has NO
 *     fs / child_process / clock of its own — every effect (stepping a tick, the mechanical passes, emitting,
 *     heartbeating the lease, sleeping) is INJECTED. `runLoop` is the runner's whole control flow, unit-tested
 *     (skills-src/conveyor/__tests__/runner.test.mjs) with fake effects — no git/network, no real lease.
 *   • The IO SHELL (the `main()` CLI + the `cli*` effect builders, gated on the main-module check) shells
 *     `tick-core.mjs` (bookkeeping in on STDIN, `{ decisions, nextState }` out), runs the two deterministic
 *     passes, prints the surface, and heartbeats the real singleton lease.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  RUNNER_LOCK_ROOT, runnerOwner,
  acquireRunnerLease, heartbeatRunnerLease, releaseRunnerLeaseIfOwned,
} from './runner-lock.mjs';
import { selectStatusCandidates } from '../../scripts/conveyor/reconcile-core.mjs';

/** The runner's tick interval — matches the SKILL's chained-sleep heartbeat (§2.5): ~120 s, just under the
 *  5-min prompt-cache window so a main-session loop's ticks stay cheap. The headless runner spends no model
 *  context, so the interval is only about how promptly it reacts to freed lanes / new PRs. */
export const DEFAULT_TICK_INTERVAL_MS = 120_000;

// ── PURE CORE (no IO — every effect is injected; unit-tested directly) ─────────────────────────────────────

/**
 * Build the NEXT tick's STDIN payload from THIS tick's output, threading `nextState` through UNCHANGED. This
 * is the thin-shell invariant made explicit: the runner carries the tick core's bookkeeping forward verbatim
 * — it never edits a guard, a TTL counter, or the watcher set (the core owns all of it). `signals` (e.g.
 * `returnedBuildNums`) are the ONLY thing the runner may add, and only from observed agent completions.
 * @returns {{ bookkeeping: object, signals: object }}
 */
export function carryForward(out, { signals = {} } = {}) {
  return { bookkeeping: (out && out.nextState) || {}, signals: signals || {} };
}

/**
 * Decide whether the loop STOPS after processing this tick. Two mechanical stop conditions, both from the core
 * (never re-derived): the core's `decisions.idleStop` (queue-empty AND no operator feedback for the window),
 * or a spent tick budget (`--max-ticks`, for a bounded/`--once` run). Pure — no clock.
 * @returns {{ stop: boolean, reason: string|null }}
 */
export function shouldStop(out, { tick = 0, maxTicks = Infinity } = {}) {
  if (out && out.decisions && out.decisions.idleStop) return { stop: true, reason: 'idle-stop' };
  if (Number.isFinite(maxTicks) && tick + 1 >= maxTicks) return { stop: true, reason: 'max-ticks' };
  return { stop: false, reason: null };
}

/**
 * The tick's SURFACE — exactly what the headless runner emits each tick. It spends no model context, so it
 * does NOT spawn the delivery / prepare / fix / CI-heal agents itself; it hands the core's already-filtered
 * decisions to the judgment layer to execute (#2701 clause 3), alongside the status line and per-tick notes.
 * A pure projection of `decisions` — it invents nothing and drops nothing.
 */
export function tickSurface(out) {
  const d = (out && out.decisions) || {};
  return {
    statusLine: d.statusLine || '',
    notes: Array.isArray(d.notes) ? d.notes : [],
    dispatch: {
      builds: Array.isArray(d.spawnBuilds) ? d.spawnBuilds : [],
      prepareScope: Array.isArray(d.spawnPrepareScope) ? d.spawnPrepareScope : [],
      prepareDecision: Array.isArray(d.spawnPrepareDecision) ? d.spawnPrepareDecision : [],
      fixes: Array.isArray(d.spawnFixes) ? d.spawnFixes : [],
      ciHeals: Array.isArray(d.spawnCiHeals) ? d.spawnCiHeals : [],
    },
    armWatchers: Array.isArray(d.armWatchers) ? d.armWatchers : [],
  };
}

/**
 * The runner's WHOLE control flow, as a reducer over injected effects — so it is unit-testable with fakes and
 * carries no IO of its own. Each tick: step the core (`tickOnce`), emit the surface, run the deterministic
 * mechanical passes, check stop, heartbeat the singleton lease, sleep, then carry `nextState` forward. A lost
 * lease (another process reclaimed a stale runner) STOPS the loop — the singleton right to drive is gone.
 *
 * @param {object} effects
 * @param {(payload:object)=>Promise<object>|object} effects.tickOnce  step the tick core → `{ decisions, nextState }`
 * @param {(surface:object,ctx:object)=>any} [effects.emit]            surface the tick (status + notes + dispatch)
 * @param {(ctx:object)=>any} [effects.mechanicalPasses]              run the no-LLM passes (§4b infra, §4c/§4d reapers)
 * @param {()=>boolean|Promise<boolean>} [effects.heartbeat]           extend the singleton lease; false ⇒ lost
 * @param {(ms:number)=>any} [effects.sleep]                           wait between ticks
 * @param {number} [effects.intervalMs]                                tick interval
 * @param {number} [effects.maxTicks]                                  bounded-run tick budget (Infinity = forever)
 * @param {object} [effects.initial]                                   first tick's STDIN payload (default `{}`)
 * @returns {Promise<{ ticks: number, stoppedReason: string, lastOut: object|null }>}
 */
export async function runLoop({
  tickOnce,
  emit = () => {},
  mechanicalPasses = () => {},
  heartbeat = () => true,
  sleep = () => {},
  intervalMs = DEFAULT_TICK_INTERVAL_MS,
  maxTicks = Infinity,
  initial = {},
} = {}) {
  if (typeof tickOnce !== 'function') throw new TypeError('runLoop requires a tickOnce effect');
  let payload = initial || {};
  let tick = 0;
  let stoppedReason = 'unknown';
  let lastOut = null;
  // The loop stops on the core's idle-stop, a spent `maxTicks` budget, or a lost lease; a real run passes
  // `maxTicks: Infinity` and relies on idle / lease-loss to end it (a test always bounds it via `maxTicks`).
  for (;;) {
    const out = await tickOnce(payload);
    lastOut = out;
    await emit(tickSurface(out), { tick });
    // Best-effort deterministic passes — a throw here must never wedge the loop (mirrors the SKILL's §4b/§4c/§4d
    // "best-effort; its exit never gates the tick").
    try { await mechanicalPasses({ tick, out }); } catch { /* best-effort — a pass failure never stalls a tick */ }

    const stop = shouldStop(out, { tick, maxTicks });
    if (stop.stop) { stoppedReason = stop.reason; break; }

    // Extend the singleton lease BEFORE sleeping; if it was reclaimed away (this runner went stale), STOP — we
    // no longer hold the sole-driver right, and continuing would risk the double-dispatch the lock prevents.
    const alive = await heartbeat();
    if (!alive) { stoppedReason = 'lease-lost'; break; }

    await sleep(intervalMs);
    // No `signals` folded in: this runner spawns no LLM agents (it only SURFACES the core's decisions — #2701
    // clause 3), so it observes no agent RETURN and has no `returnedBuildNums` to inject. Build guards still
    // retire via the CLAIMED path off each tick's fresh state read. Folding observed returns is #2703's job
    // (wiring headless agent-spawning), not this slice's.
    payload = carryForward(out);
    tick += 1;
  }
  return { ticks: tick + 1, stoppedReason, lastOut };
}

// ── IO SHELL (runs only as a CLI — owns all child_process / real lease; keeps the pure core effect-free) ────

/** Build the real `tickOnce` effect: shell `tick-core.mjs`, pipe the bookkeeping payload in on STDIN, parse
 *  `{ decisions, nextState }` off STDOUT. This is the SAME core the main-session SKILL loop shells (§2b) — the
 *  runner and the SKILL can never disagree on a guard, because there is exactly ONE core. */
function makeCliTickOnce({ tickCorePath, repo = null }) {
  return async (payload) => {
    const { execFileSync } = await import('node:child_process');
    const args = [tickCorePath];
    if (typeof repo === 'string' && repo) args.push(`--repo=${repo}`);
    const out = execFileSync('node', args, {
      input: JSON.stringify(payload || {}),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
    return JSON.parse(out);
  };
}

/** Build the real `mechanicalPasses` effect: the deterministic, no-LLM passes the SKILL runs each tick —
 *  the infra-blocked recovery pass (§4b), the lease-reaper (§4c), the session-reaper (§4d, WE #3435 — stops
 *  a `claude agents` background session once ITS OWN process reports `done`/`failed`, a wholly separate
 *  resource from a lane lease), the reconcile-fix dispatch pass (#3438 — dispatches the fix agent
 *  `we:scripts/conveyor/reconcile-pass.mjs` decides is owed for a bounced PR with nothing live working it, a
 *  genuinely different population from `decisions.spawnFixes`'s own tick-core-launched-PRs-only scope; see that
 *  file's own header for the full reasoning), the branch-drift sweep (#3464 — `we:scripts/conveyor/
 *  branch-drift.mjs sweep`: reports the long-lived dispatched-work branch's live divergence/conflict state to
 *  its durable git-note report, the SAME "piggyback on a pass this headless runner already ticks" shape #3449
 *  used for lane-pool lease reconciliation, so drift is caught without a human or interactive session ever
 *  noticing it by hand), the parked-PR conflict watch (#xw0odtv — `we:scripts/conveyor/
 *  parked-pr-conflict-watch.mjs sweep`: labels + one-time-comments any review-parked PR that has drifted into a
 *  real merge conflict against `main`, catching exactly the axis branch-drift's single-branch watch and #2824's
 *  BEHIND-only freshness gate both leave uncovered), the review-reconcile pass (epic #3383, x5v8yy9 — reads
 *  `conveyor/reconcile-pass.mjs`'s own decision and dispatches `operations/review-dispatch.mjs` for every PR it
 *  names, plus the purely-informative `review-round-tag.mjs`/`review-status-tag.mjs` labels — the review step
 *  is now actually mechanized, not merely planned; see {@link selectStatusCandidates} for which PRs the status
 *  refresh covers), and (#3421) the blocking-hiccup sink. All eight are best-effort: a failure is swallowed
 *  (logged to stderr) and never gates the tick. Never a local merge — the drain stays the sole writer to
 *  `main`.
 *
 *  THE REVIEW-RECONCILE PASS needs no session-ephemeral bookkeeping of its own, unlike the tick's own
 *  build/prepare/fix/ci-heal guards: `reconcile-pass.mjs` reads real ground truth (findings on the PR, a live
 *  `claude agents` session bound to it via cwd/HEAD sha) every time it runs, so it can just be re-run every
 *  tick, safely — the same way `infra-blocked.mjs`/`lease-reaper.mjs` already are. Double-dispatch is already
 *  guarded UPSTREAM, not here: `reconcile-core.mjs`'s own liveness read binds a live session to a PR and
 *  refuses (`live-process`) BEFORE the `review` dispatch decision is ever reached, so a review already in
 *  flight for a PR simply does not appear in next tick's plan.
 *
 *  THE HICCUP SINK is the ONLY one of the eight that reads `out` (this tick's already-computed
 *  `decisions.suppressedBuilds` — the #3416 guard-suppression shape): it is the mechanical half of #3421's
 *  auto-file-a-fix story, filing a gated `blocking` learnings entry the moment a live guard holds a
 *  dispatch, rather than waiting for a human `/note`. It files NOTHING for the #3412 free-form-response
 *  shape — this runner spawns no LLM agents (#2701 clause 3) and so never observes an agent's return; that
 *  classification is the judgment layer's own job (skills-src/conveyor/SKILL.md), via the same
 *  hiccup-sink.mjs `fileHiccup`. */

/** Cap on {@link summarizeMechanicalPassError}'s output — generous for a real diagnostic, still bounded so one
 *  runaway stack trace can't flood `runner.log`. */
export const MECHANICAL_PASS_ERROR_LOG_CHARS = 800;

/**
 * The text `runQuiet` (below) logs for a failed mechanical pass — found live 2026-09-04 investigating a
 * `session-reaper.mjs` failure: `execFileSync`'s thrown error's OWN `.message` already carries the child's full
 * captured stderr, appended by Node itself after the leading `Command failed: <cmd>` line — but the previous
 * `String(e.message || e).split('\n')[0]` kept ONLY that first line and threw away everything after it,
 * discarding the real error on EVERY mechanical-pass failure this runner has ever logged, not just that one.
 * The one line `runner.log` actually recorded that night — `⚠ mechanical pass conveyor/session-reaper.mjs
 * failed (non-fatal): Command failed: node .../session-reaper.mjs` — carries zero information about WHY;
 * reproducing the exact same truncation against a real `execFileSync` throw (a child that `console.error`s
 * detail then exits 1) confirmed this is the whole gap, byte for byte. Collapses whitespace/newlines so a
 * multi-line stderr still logs as ONE `runner.log` line (grep-able, matching the file's existing one-line-per-
 * event convention), bounded to `maxChars` rather than left unbounded.
 * @param {unknown} e
 * @param {number} [maxChars]
 * @returns {string}
 */
export function summarizeMechanicalPassError(e, maxChars = MECHANICAL_PASS_ERROR_LOG_CHARS) {
  const full = String((e && e.message) || e);
  return full.replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

function makeCliMechanicalPasses({ scriptsDir, repo = null, hiccupSession } = {}) {
  return async ({ out } = {}) => {
    const { execFileSync } = await import('node:child_process');
    const runQuiet = (relPath, extraArgs = []) => {
      try {
        const args = [join(scriptsDir, relPath), ...extraArgs];
        if (typeof repo === 'string' && repo) args.push(`--repo=${repo}`);
        execFileSync('node', args, { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
      } catch (e) {
        process.stderr.write(`⚠ mechanical pass ${relPath} failed (non-fatal): ${summarizeMechanicalPassError(e)}\n`);
      }
    };
    runQuiet('conveyor/infra-blocked.mjs', ['retry']);
    runQuiet('conveyor/lease-reaper.mjs');
    runQuiet('conveyor/session-reaper.mjs'); // §4d — WE #3435
    runQuiet('conveyor/reconcile-fix-dispatch.mjs'); // #3438
    // #3464 — sweeps its OWN default watched branch (`lane/mechanical-dispatcher` vs `main`), env/flag
    // overridable. `runQuiet` still appends `--repo=<repo>` when this runner was given one — harmless, since
    // `branch-drift.mjs`'s CLI parses and simply ignores any flag it doesn't itself read.
    runQuiet('conveyor/branch-drift.mjs', ['sweep']);
    // #xw0odtv — sweeps every OPEN PR for a review-parked (review:human/pending/uncleared-changes) hold that
    // has drifted into a REAL merge conflict (mergeable === CONFLICTING) against main, applying an informative
    // `merge-status:conflicting` label + a one-time comment (self-clearing once the conflict resolves). Distinct
    // from #2824 (BEHIND-only, not yet built) and from branch-drift.mjs (one named branch, not the open-PR
    // population) — see that file's own header for the full gap this closes.
    runQuiet('conveyor/parked-pr-conflict-watch.mjs', ['sweep']);
    // Epic #3383 — MECHANIZE THE REVIEW STEP (x5v8yy9). `conveyor/reconcile-pass.mjs` (#3296) already decides
    // WHEN an open PR is owed an independent review — it reads real ground truth (findings on the PR, a live
    // `claude agents` session bound to it via cwd/HEAD sha) every time it runs, so unlike the tick's own
    // build/prepare/fix/ci-heal guards it needs NO session-ephemeral bookkeeping of its own; it can just be
    // re-run every tick, safely, the same way `infra-blocked.mjs`/`lease-reaper.mjs` already are.
    // `operations/review-dispatch.mjs` (#3279) existed and worked standalone, but nothing called it
    // automatically — this closes that gap.
    //
    // DOUBLE-DISPATCH IS ALREADY GUARDED, UPSTREAM, NOT HERE. `reconcile-core.mjs`'s own liveness read binds a
    // live session to a PR (cwd → HEAD sha) and refuses (`live-process`) BEFORE the `review` dispatch decision
    // is ever reached — so a review already in flight for a PR simply does not appear in next tick's plan.
    //
    // SEQUENTIAL, mirroring `makeCliDispatchPass`'s own reasoning even though nothing here shares guard state:
    // firing N `claude --bg` review spawns at once has no benefit and this keeps one bad dispatch's blast
    // radius the same as every other pass here (best-effort — a single PR's dispatch failure never stops the
    // rest of the tick, or the tick itself).
    try {
      const reconcileArgs = [join(scriptsDir, 'conveyor', 'reconcile-pass.mjs'), '--json'];
      if (typeof repo === 'string' && repo) reconcileArgs.push(`--repo=${repo}`);
      const reconcileOut = execFileSync('node', reconcileArgs, {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024,
      });
      const plan = JSON.parse(reconcileOut);
      const reviewsOwed = (Array.isArray(plan.dispatch) ? plan.dispatch : []).filter((d) => d && d.kind === 'review');
      // x5v8yy9 — every PR this pass has an OPINION about, informatively tagged, EXCLUDING only `nothing-owed`
      // (reviewed/queued/landed, or a genuinely signal-free PR). `owed-elsewhere` is NOT excluded — it covers
      // real conveyor PRs stuck `needs-human`/`ci-red`/`conflicted`, not just unrelated ones (see
      // `selectStatusCandidates`'s own docblock for the PR #1920 staleness incident this fixes).
      const statusCandidates = selectStatusCandidates(reviewsOwed, plan.refusals);
      if (reviewsOwed.length || statusCandidates.length) {
        // `review-dispatch.mjs` / the tag scripts REQUIRE a real `owner/repo` slug (unlike `reconcile-pass.mjs`,
        // which lets `gh` resolve it from cwd) — resolve it once, lazily, only when there is actually work to
        // do, so the common empty-plan tick never pays for an extra `gh` call.
        const repoSlug = typeof repo === 'string' && repo
          ? repo
          : execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], {
            encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
          }).trim();
        for (const d of reviewsOwed) {
          try {
            execFileSync('node', [join(scriptsDir, 'operations', 'review-dispatch.mjs'), `--pr=${d.prNumber}`, `--repo=${repoSlug}`],
              { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
          } catch (e) {
            process.stderr.write(`⚠ mechanical pass review-dispatch --pr=${d.prNumber} failed (non-fatal): ${String(e.message || e).split('\n')[0]}\n`);
          }
          // PURELY INFORMATIVE (`review-round-tag.mjs`) — a `review-round:<N>` label so a human scanning the
          // PR list can see how many rounds a PR has been through with no click-through. `d.attempts` is
          // `reconcile-pass.mjs`'s own durable re-arm count for THIS PR — the round about to run is one past
          // that. Best-effort: a failed tag write never blocks a review from actually being dispatched.
          try {
            execFileSync('node', [join(scriptsDir, 'conveyor', 'review-round-tag.mjs'), String(d.prNumber), `--repo=${repoSlug}`, `--round=${(d.attempts ?? 0) + 1}`],
              { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 8 * 1024 * 1024 });
          } catch (e) {
            process.stderr.write(`⚠ mechanical pass review-round-tag --pr=${d.prNumber} failed (non-fatal): ${String(e.message || e).split('\n')[0]}\n`);
          }
        }
        // PURELY INFORMATIVE (`review-status-tag.mjs`) — "is a reviewer or a fixer actually working this PR
        // right now, or is a live session stuck". Covers PRs NOT being freshly dispatched this tick too (an
        // already-live session, or one that just finished and needs its stale label cleared).
        for (const c of statusCandidates) {
          try {
            execFileSync('node', [join(scriptsDir, 'conveyor', 'review-status-tag.mjs'), String(c.prNumber), `--repo=${repoSlug}`],
              { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 8 * 1024 * 1024 });
          } catch (e) {
            process.stderr.write(`⚠ mechanical pass review-status-tag --pr=${c.prNumber} failed (non-fatal): ${String(e.message || e).split('\n')[0]}\n`);
          }
        }
      }
    } catch (e) {
      process.stderr.write(`⚠ mechanical pass conveyor/reconcile-pass.mjs failed (non-fatal): ${String(e.message || e).split('\n')[0]}\n`);
    }
    try {
      // Literal relative specifiers (not scriptsDir-joined) — a computed dynamic-import argument trips
      // Vite/Rollup's SSR import analysis (used to transform this file under vitest); a string literal is
      // what every bundler's static import graph expects. runner.mjs lives in skills-src/conveyor/, these
      // two in scripts/conveyor/ — the SAME relative hop TICK_CORE itself resolves via SCRIPTS_DIR above.
      const { classifySuppressedBuilds } = await import('../../scripts/conveyor/hiccup-classify.mjs');
      const { fileHiccups } = await import('../../scripts/conveyor/hiccup-sink.mjs');
      const suppressed = out && out.decisions && out.decisions.suppressedBuilds;
      const hiccups = classifySuppressedBuilds(suppressed);
      if (hiccups.length) fileHiccups(hiccups, { session: hiccupSession });
    } catch (e) {
      process.stderr.write(`⚠ mechanical pass hiccup-sink failed (non-fatal): ${String(e.message || e).split('\n')[0]}\n`);
    }
  };
}

/** Build the real `emit` effect: print the tick's status line + notes, and the dispatch/watch decisions the
 *  judgment layer executes (the runner spends no model context, so it surfaces them — #2701 clause 3). */
function makeCliEmit({ json = false } = {}) {
  return (surface, ctx) => {
    if (json) { process.stdout.write(JSON.stringify({ tick: ctx.tick, ...surface }) + '\n'); return; }
    const { dispatch } = surface;
    const counts = `${dispatch.builds.length} build · ${dispatch.prepareScope.length + dispatch.prepareDecision.length} prepare · ${dispatch.fixes.length} fix · ${dispatch.ciHeals.length} heal · ${surface.armWatchers.length} watch`;
    process.stdout.write(`[tick ${ctx.tick}] ${surface.statusLine || '(no status)'}\n`);
    if (dispatch.builds.length || dispatch.prepareScope.length || dispatch.prepareDecision.length || dispatch.fixes.length || dispatch.ciHeals.length || surface.armWatchers.length) {
      process.stdout.write(`  ↳ surface for judgment layer: ${counts}\n`);
    }
    for (const n of surface.notes) process.stdout.write(`  ${n.text || JSON.stringify(n)}\n`);
  };
}

function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

/** Coerce a flag value to a finite number, falling back when it is absent / bare (`true`) / non-numeric —
 *  so `--max-ticks=abc` can never silently become `NaN` (which would never trip the max-ticks stop). */
function finiteOr(val, fallback) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Acquire the singleton lease, drive the loop, and ALWAYS release the lease — the lifecycle wrapper, kept
 * SEPARATE from `main()` so it is unit-testable without `process.exit` (which does NOT unwind a `finally`, so
 * the release MUST NOT sit behind an exit). A held lease returns `{ started: false }` so the caller stands
 * down; otherwise the lease is released in the `finally` before the caller exits. The lease heartbeat is wired
 * IN here (over the injected `heartbeat`), so the loop's lease-loss stop reflects the real singleton right.
 * @returns {Promise<{ started: boolean, reason?: string, heldBy?: string|null, ticks?: number, stoppedReason?: string }>}
 */
export async function driveConveyor({
  lockRoot = RUNNER_LOCK_ROOT,
  owner = runnerOwner(),
  buildEffects,
  acquire = acquireRunnerLease,
  heartbeat = heartbeatRunnerLease,
  release = releaseRunnerLeaseIfOwned,
} = {}) {
  if (typeof buildEffects !== 'function') throw new TypeError('driveConveyor requires a buildEffects factory');
  const acq = acquire(lockRoot, owner);
  if (!acq.ok) return { started: false, reason: acq.reason || 'held', heldBy: acq.heldBy ?? null };
  try {
    const effects = { ...buildEffects(owner), heartbeat: () => heartbeat(lockRoot, owner) };
    const result = await runLoop(effects);
    return { started: true, ticks: result.ticks, stoppedReason: result.stoppedReason };
  } finally {
    // Release BEFORE the caller exits — never behind a `process.exit` (which would skip it and leak the lease
    // for the full TTL, falsely standing down every launch inside that window). This is the drain daemon's
    // release-then-exit ordering (we:scripts/lane-drain.mjs), not a finally-after-exit.
    release(lockRoot, owner);
  }
}

async function main(argv) {
  const flags = parseFlags(argv);

  const HERE = dirname(fileURLToPath(import.meta.url));
  // Runner lives in skills-src/conveyor/; the tick core + the deterministic passes live in scripts/.
  const SCRIPTS_DIR = join(HERE, '..', '..', 'scripts');
  const TICK_CORE = join(SCRIPTS_DIR, 'conveyor', 'tick-core.mjs');

  const repo = typeof flags.repo === 'string' ? flags.repo : null;
  const json = !!flags.json;
  const intervalMs = finiteOr(flags['interval-ms'], DEFAULT_TICK_INTERVAL_MS);
  const maxTicks = flags.once ? 1 : finiteOr(flags['max-ticks'], Infinity);

  const hiccupSession = typeof flags['hiccup-session'] === 'string' ? flags['hiccup-session'] : undefined;
  const buildEffects = () => ({
    tickOnce: makeCliTickOnce({ tickCorePath: TICK_CORE, repo }),
    emit: makeCliEmit({ json }),
    mechanicalPasses: makeCliMechanicalPasses({ scriptsDir: SCRIPTS_DIR, repo, hiccupSession }),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    intervalMs,
    maxTicks,
    initial: {},
  });

  // #2702 SINGLETON LOCK — `driveConveyor` acquires the sole-driver right, runs the loop, and ALWAYS releases
  // the lease (in its `finally`, before we exit). A LIVE runner already driving ⇒ `started:false`, a polite
  // stand-down (exit 0, not an error).
  const outcome = await driveConveyor({ owner: runnerOwner(), buildEffects });
  if (!outcome.started) {
    process.stderr.write(`✗ another conveyor runner holds the singleton lease (heldBy=${outcome.heldBy}); standing down.\n`);
  } else {
    process.stderr.write(`conveyor runner stopped: ${outcome.stoppedReason} after ${outcome.ticks} tick(s).\n`);
  }
  process.exit(0);
}

// Run the IO shell only when invoked directly — never on import (keeps the pure core side-effect-free).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).catch((e) => { process.stderr.write(`✗ runner error: ${String(e && e.stack || e)}\n`); process.exit(1); });
}
