/**
 * @file scripts/operations/restart-runner.mjs
 * @description THE SAFE CONVEYOR RESTART, declared (#3383) — `run.mjs restart-runner`. The four-step sequence
 *   the operator kept doing by hand after every kill, and which only became safe to mechanize once
 *   `we:skills-src/conveyor/runner.mjs` grew a SIGTERM handler that actually releases its singleton lease and
 *   announces its exit (the sibling commit on this branch).
 *
 * DECLARED, NOT A PLAIN MODULE. This started as a plain module on the `we:scripts/operations/dispatch-abort.mjs`
 * precedent and was converted on the operator's call. The conversion is the right one, and the reasoning that
 * exempts `dispatch-abort` does not carry over: that file is a one-shot repair over a run record that ALREADY
 * exists (it closes somebody else's effect out through `wake.mjs#closeOutEntry`), and it has no sibling caller.
 * This operation is the opposite on both counts — a `read → plan → effect → effect → gate → effect` pipeline
 * whose every refusal is a decision worth a durable record, with the conveyor skill and any future
 * supervisor-health automation as exactly the sibling callers a derived command line and route exist to serve.
 * What it buys concretely: the run record says which refusal fired and on what evidence, each effect is keyed
 * by run + step + ordinal so a partial failure is replay-safe, and neither the CLI nor a route is written here.
 *
 * NO `declaresOver`. Like `record-verdict`, this replaces a hand-assembled sequence of shell commands, not a
 * CLI with a name — there is no raw home for a skill to bypass, so an entry in
 * `we:scripts/operations/declared-homes.mjs` would be a guessed one, which that file's own header explains is
 * worse than none at all.
 *
 * ── THE FOUR STEPS, AND WHAT EACH GUARDS ────────────────────────────────────────────────────────────────────
 *
 *   1. REFUSE UNDER A JUST-SPAWNED BUILD AGENT. The one genuine loss window. A `conveyor-<num>` build agent
 *      that `claude --bg` has spawned but `claude agents --json` has not yet listed has NO durable floor
 *      anywhere: not in the listing, and not yet in bookkeeping the next tick would read. Restart into that
 *      window and the new runner's in-flight guard cannot see the agent, so it dispatches the same item again
 *      — the double-dispatch the guards exist to prevent, at the one moment they are blind.
 *
 *      NOTE WHAT THIS DOES *NOT* CLAIM. Seeing a recent spawn does not prove an unlisted one exists; it proves
 *      dispatch is ACTIVE right now, which is the only observable proxy for "another may be mid-flight and
 *      invisible". The window is a cooling-off period, not a detector. Refusing is cheap (wait a minute);
 *      restarting into it is not (a duplicate delivery agent on a real lane).
 *
 *   2. SHUT DOWN CLEANLY, AND CONFIRM IT BY EVIDENCE — never a timeout. See {@link ./restart-runner-io.mjs}'s
 *      `confirmShutdown` for what counts as evidence and why.
 *   3. SWEEP A LEAKED LEASE, on two agreeing signals only. See {@link classifyLease}.
 *   4. START FRESH — and only behind {@link gateStart}, which re-reads both prior effects' findings.
 *
 * ── PURE. NO `node:` SPECIFIER, NO PACKAGE, NOT ITS OWN IO MODULE ───────────────────────────────────────────
 *
 * Asserted by the suite the same way `dispatch-lane.mjs`'s is, and it costs something real here, so it is
 * worth naming: this operation SIGNALS PROCESSES AND SPAWNS ONE. Every one of those verbs lives in
 * {@link ./restart-runner-io.mjs}; the step fns below hold no killer and no spawner in lexical scope, and the
 * import graph is what proves it rather than a comment.
 *
 * THE COST OF THAT PURITY, stated plainly, because it shapes two functions below. The `conveyor-<num>` slug
 * grammar lives in `we:scripts/conveyor/lease-reaper.mjs#itemNumFromSession` and the lease TTL rule in
 * `we:scripts/readiness/file-locks.mjs#isLeaseExpired` — both impure modules. Rather than re-derive either
 * here (a second, looser copy of that slug matcher is exactly the #3283 incident), the READER calls them and
 * hands the ANSWERS down as facts: each agent row arrives already carrying `buildItemNum`, and the lease
 * arrives already carrying `expired`/`pidAlive`. The DECISIONS over those facts — which window counts, and
 * that `'stale'` needs both signals — stay here, where they are testable with plain objects.
 */

import { op } from './registry.mjs';
import { compute, effect as effectStep } from './step-kinds.mjs';

export const RESTART_RUNNER_OP = 'restart-runner';

/** SIGTERM the process that owns the loop, then wait for evidence it is down. Applied by the io shell. */
export const SHUTDOWN_EFFECT = 'conveyor.runner-shutdown';
/** Remove a leaked singleton lease. Applied by the io shell; a no-op unless the lease is provably stale. */
export const SWEEP_LEASE_EFFECT = 'conveyor.stale-lease-sweep';
/** Launch a fresh detached supervisor. Applied by the io shell. */
export const START_SUPERVISOR_EFFECT = 'conveyor.supervisor-start';

/** A `conveyor-<num>` session younger than this means dispatch is active right now, and a sibling spawn may
 *  not be listed yet. 60 s is the operator's own figure from the 2026-09-12 investigation, and it comfortably
 *  covers the gap between `claude --bg` returning a handle and the session appearing in a listing. */
export const RECENT_SPAWN_WINDOW_MS = 60_000;

/** How long the io shell waits for EVIDENCE of a clean exit before giving up and saying so. The supervisor's
 *  own SIGTERM→SIGKILL grace on its child is 5 s, so a clean shutdown is normally sub-second; this is sized
 *  for a runner that has to finish a blocking mechanical pass first. */
export const SHUTDOWN_CONFIRM_TIMEOUT_MS = 90_000;

/** Poll cadence for every bounded wait in this operation. Fast enough to feel instant, slow enough not to spin. */
export const POLL_INTERVAL_MS = 500;

/** How long `--wait` sits through an active dispatch before giving up and refusing anyway. */
export const WAIT_TIMEOUT_MS = 5 * 60_000;

// ── step 1's predicate ─────────────────────────────────────────────────────────────────────────────────────

/**
 * The `conveyor-<num>` BUILD sessions spawned within `windowMs` of `nowMs`. PURE.
 *
 * Only `conveyor-*` — not `fix-*`, `review-*`, `prepare-*`. The loss window this guards is specifically a
 * DELIVERY dispatch whose lane lease and in-flight guard are still settling; the others either re-derive their
 * own state from GitHub labels on the next pass (fix/review) or take no lane lease at all (prepare). Widening
 * it would make the refusal fire constantly on a busy board for no added safety.
 *
 * `buildItemNum` is the READER's answer, not a match made here — see the purity note in the file header. A row
 * whose `buildItemNum` is null is not a build session, whatever its name happens to look like.
 *
 * @param {{name: string, id: string|null, startedAt: number, buildItemNum: string|null}[]} agents
 * @param {{nowMs?: number, windowMs?: number}} [o]
 * @returns {{name: string, id: string|null, ageMs: number}[]} youngest first.
 */
export function recentBuildSpawns(agents, { nowMs = 0, windowMs = RECENT_SPAWN_WINDOW_MS } = {}) {
  return (Array.isArray(agents) ? agents : [])
    .filter((a) => !!a && typeof a === 'object' && a.buildItemNum !== null && a.buildItemNum !== undefined)
    .map((a) => ({ name: String(a.name ?? ''), id: a.id ?? null, ageMs: nowMs - Number(a.startedAt) }))
    // A row whose `startedAt` is missing/garbage yields NaN, and `NaN < windowMs` is false — so it reads as
    // OLD, not recent. That is the right direction: an unreadable timestamp must not be able to wedge every
    // restart forever, and the lease and target checks downstream still protect the actual dispatch.
    .filter((r) => r.ageMs >= 0 && r.ageMs < windowMs)
    .sort((a, b) => a.ageMs - b.ageMs);
}

// ── the lease decision ─────────────────────────────────────────────────────────────────────────────────────

/**
 * What the singleton lease on disk means right now — the ONE place this operation decides it. PURE over the
 * reader's already-read `expired`/`pidAlive` facts.
 *
 * `'stale'` requires BOTH signals to agree: the heartbeat is past the TTL *and* the recorded pid is not alive.
 * Either alone is unsafe to act on. A past-TTL heartbeat by itself can be a runner wedged inside a long
 * blocking pass — reaping its lease hands the singleton right to a second runner while the first is still
 * driving, which is the exact double-dispatch the lease exists to prevent. A dead pid by itself is not proof
 * in the other direction: pids are reused, so a live-looking pid may belong to something unrelated. Requiring
 * the intersection makes a false `'stale'` need two independent things to be wrong at once.
 *
 * @param {{present: boolean, pid: number|null, owner: string|null, heartbeatAt: string|null, expired: boolean, pidAlive: boolean|null}|null} raw
 * @returns {{state: 'none'|'live'|'stale', pid: number|null, owner: string|null, heartbeatAt: string|null, pidAlive: boolean|null, expired: boolean}}
 */
export function classifyLease(raw) {
  if (!raw || raw.present !== true) {
    return { state: 'none', pid: null, owner: null, heartbeatAt: null, pidAlive: null, expired: false };
  }
  const expired = raw.expired === true;
  const pidAlive = raw.pidAlive === null || raw.pidAlive === undefined ? null : raw.pidAlive === true;
  return {
    state: expired && pidAlive === false ? 'stale' : 'live',
    pid: Number.isFinite(Number(raw.pid)) ? Number(raw.pid) : null,
    owner: raw.owner ?? null,
    heartbeatAt: raw.heartbeatAt ?? null,
    pidAlive,
    expired,
  };
}

// ── step 1: shape the read ─────────────────────────────────────────────────────────────────────────────────

/**
 * Turn the reader's raw observation into the finding every later step reads. PURE.
 *
 * `listingReadable: false` is CARRIED rather than thrown on, because the PLAN is where it has to be acted on:
 * an unreadable `claude agents --json` must fail CLOSED, and a read that threw would abort the run with no
 * record of why it refused. Same reasoning `shapeDispatchRead` gives for reporting `bookkeepingSource` onto
 * the verdict instead of failing.
 *
 * @param {object} raw - from `createRestartReader` (`we:scripts/operations/restart-runner-io.mjs`).
 * @param {{windowMs?: number}} [o]
 */
export function shapeRestartRead(raw, { windowMs = RECENT_SPAWN_WINDOW_MS } = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const nowMs = Number(r.observedAtMs) || 0;
  return {
    observedAtMs: nowMs,
    listingReadable: r.listingReadable !== false,
    listingError: r.listingError ?? null,
    waitedMs: Number(r.waitedMs) || 0,
    windowMs,
    recent: recentBuildSpawns(r.agents, { nowMs, windowMs }),
    lease: classifyLease(r.lease),
    // Which process actually owns the restart loop — the reader walked `ps` up from the lease's runner pid.
    // See the io shell's `resolveTarget` for why the SUPERVISOR is the right target when one is resident.
    target: {
      kind: r.target?.kind ?? 'none',
      pid: r.target?.pid ?? null,
      command: r.target?.command ?? null,
    },
    // Counted BEFORE anything is signalled, so `confirmShutdown` can wait for the ledger to GROW rather than
    // mistaking a pre-existing exit row from an earlier restart for this run's confirmation.
    baselineExitCount: Number(r.baselineExitCount) || 0,
  };
}

// ── step 2: the verdict ────────────────────────────────────────────────────────────────────────────────────

/**
 * THE VERDICT: may this restart proceed, and what does it have to signal? PURE.
 *
 * `--force` skips the recent-spawn guard and SAYS SO on the verdict rather than silently passing — an operator
 * reading the run record must be able to tell "no dispatch was in flight" from "nobody checked".
 */
export function planRestart({ read, force = false, waited = false } = {}) {
  const r = read || {};
  const windowSec = Math.round((r.windowMs ?? RECENT_SPAWN_WINDOW_MS) / 1000);
  const base = { target: r.target ?? { kind: 'none', pid: null, command: null }, lease: r.lease ?? { state: 'none' } };

  // FAILS CLOSED, and `--force` is the only way past it. The guard's entire value is knowing whether a
  // dispatch just happened; proceeding on "I couldn't tell" would silently turn the one refusal that matters
  // into a no-op, which is how a fail-open guard becomes worse than no guard.
  if (!force && r.listingReadable === false) {
    return {
      ...base,
      proceed: false,
      guard: 'listing-unreadable',
      guardSkipped: false,
      recent: [],
      refusal: `restart-runner: REFUSING — could not read \`claude agents --json\` (${r.listingError || 'unknown error'}). `
        + 'The recent-spawn guard cannot be evaluated, so this fails closed. Re-run, or pass --force if you know no dispatch is in flight.',
    };
  }

  const recent = force ? [] : (r.recent || []);
  if (recent.length) {
    const names = recent.map((x) => `${x.name} (${Math.round(x.ageMs / 1000)}s ago)`).join(', ');
    return {
      ...base,
      proceed: false,
      guard: 'recent-spawn',
      guardSkipped: false,
      recent,
      refusal: `restart-runner: REFUSING — ${recent.length} build agent(s) spawned in the last ${windowSec}s: ${names}. `
        + 'A just-spawned dispatch has no durable floor yet, so restarting now risks a double-dispatch. '
        + (waited
          ? `--wait gave up after ${Math.round((r.waitedMs || 0) / 1000)}s — dispatch is still active.`
          : 'Re-run with --wait to sit it out, or --force if you know the dispatch is settled.'),
    };
  }

  return { ...base, proceed: true, guard: force ? 'skipped' : 'passed', guardSkipped: !!force, recent: [], refusal: null };
}

// ── step 5: the gate in front of the launch ────────────────────────────────────────────────────────────────

/**
 * THE ONE RESULT an effect step produced, or `null`. PURE.
 *
 * An `effect` step's finding is the ENGINE's shape, not the sink's: `{applied, effects: [{type, status,
 * result, error}]}` (`engine.mjs#effectFinding`). Every effect step here declares one effect or zero, so this
 * unwraps that single `result` — and a zero-effect step (nothing needed doing) yields `null`, which the gate
 * below reads as "not attempted", never as "failed". Written once because two readers need it and a second
 * copy would be the place they drift.
 *
 * An effect that was declared but did NOT land (`status !== 'applied'`) also yields `null` for the result and
 * is reported through `applied` instead — a sink that threw must not look like a sink that returned nothing.
 */
export function effectResult(finding) {
  const entries = Array.isArray(finding?.effects) ? finding.effects : [];
  if (!entries.length) return null;
  const first = entries[0];
  return first.status === 'applied' ? (first.result ?? null) : null;
}

/**
 * MAY A FRESH SUPERVISOR START? PURE over the two effect results. This is where the operation declines to
 * make things worse: an unconfirmed shutdown or a surviving LIVE lease each mean a launch now would either
 * race a process that may still be driving, or stand down instantly against a lock and be scored a crash.
 *
 * A zero-effect `stop` (nothing was running) and a zero-effect `sweep` arrive here as `null`, which is NOT a
 * failure — that is the plain-start path.
 */
export function gateStart({ plan, shutdown = null, sweep = null } = {}) {
  if (!plan || plan.proceed !== true) {
    return { starting: false, reason: plan?.refusal || 'restart-runner: the plan did not clear this restart' };
  }
  if (shutdown && shutdown.attempted === true && shutdown.confirmed !== true) {
    return {
      starting: false,
      reason: `restart-runner: REFUSING TO START — the shutdown was never confirmed after ${Math.round((shutdown.waitedMs || 0) / 1000)}s `
        + `(lease ${shutdown.leaseGone ? 'released' : 'STILL HELD'}, pid ${shutdown.pid} ${shutdown.pidAlive ? 'STILL ALIVE' : 'gone'}). `
        + 'Starting a second one now would race the first. Investigate before retrying.',
    };
  }
  if (sweep && sweep.state === 'live') {
    return {
      starting: false,
      reason: `restart-runner: REFUSING TO START — a LIVE lease is still held (${sweep.detail}). A fresh runner would stand down against it.`,
    };
  }
  return { starting: true, reason: 'cleared: nothing is driving, and no live lease stands in the way' };
}

// ── the declaration ────────────────────────────────────────────────────────────────────────────────────────

/**
 * BUILD THE DECLARATION. `readRestartFacts` is the injected reader; {@link ./restart-runner-io.mjs} supplies
 * the real one and tests supply a stub. Built per call so nothing leaks between registries.
 *
 * @param {{readRestartFacts: (o: object) => object}} deps
 * @returns {object} the frozen declaration from `op()`.
 */
export function restartRunnerOperation({ readRestartFacts } = {}) {
  if (typeof readRestartFacts !== 'function') {
    throw new TypeError(
      'restart-runner: needs a `readRestartFacts({wait, windowMs, waitTimeoutMs, pollMs})` reader — the io is '
      + 'INJECTED so the declaration stays testable with no `claude` listing, no `ps` and no lock root; the '
      + 'real binding is `we:scripts/operations/restart-runner-io.mjs`.',
    );
  }

  return op(RESTART_RUNNER_OP, {
    input: {
      // Where the fresh supervisor runs, and which supervisor. Both optional — the io shell defaults them to
      // this repo's own checkout and its own `skills-src/conveyor/supervisor.mjs`.
      //
      // `checkout`, NOT `cwd`: that name is a CONTROL flag on the derived command line
      // (`cli-adapter.mjs#CONTROL_FLAGS`, where it steers a juror's lane), so an input field called `cwd`
      // would be shadowed and unreachable from argv.
      checkout: { type: 'string', required: false, default: '' },
      supervisor: { type: 'string', required: false, default: '' },
      force: { type: 'boolean', required: false, default: false },
      wait: { type: 'boolean', required: false, default: false },
      windowMs: { type: 'number', required: false, default: RECENT_SPAWN_WINDOW_MS },
      shutdownTimeoutMs: { type: 'number', required: false, default: SHUTDOWN_CONFIRM_TIMEOUT_MS },
      waitTimeoutMs: { type: 'number', required: false, default: WAIT_TIMEOUT_MS },
    },
    verdictFrom: 'plan',

    // ── 1. read ───────────────────────────────────────────────────────────────────────────────────────────
    // ONE observation: the agent listing (polled, under `--wait`, until it is quiet or the deadline passes),
    // the lease with its TTL and pid-liveness already resolved, the signal target walked out of `ps`, and the
    // supervisor ledger's exit-row count taken BEFORE anything is signalled.
    read: compute({
      reads: ['input.wait', 'input.windowMs', 'input.waitTimeoutMs'],
      fn: (view) => shapeRestartRead(
        readRestartFacts({
          wait: view.input.wait === true,
          windowMs: view.input.windowMs,
          waitTimeoutMs: view.input.waitTimeoutMs,
          pollMs: POLL_INTERVAL_MS,
        }),
        { windowMs: view.input.windowMs },
      ),
    }),

    // ── 2. plan ───────────────────────────────────────────────────────────────────────────────────────────
    // THE VERDICT. A refusal is a first-class outcome here, not an error: "a build agent was spawned eight
    // seconds ago" is the normal, correct answer during an active dispatch.
    plan: compute({
      reads: ['findings.read', 'input.force', 'input.wait'],
      fn: (view) => planRestart({
        read: view.findings.read,
        force: view.input.force === true,
        waited: view.input.wait === true,
      }),
    }),

    // ── 3. stop ───────────────────────────────────────────────────────────────────────────────────────────
    // DECLARES the shutdown and performs none of it. Zero effects when the plan refused, or when there is
    // nothing running to signal — the engine resolves a zero-effect step in the same `advance` rather than
    // suspending, so a plain start completes the run instead of parking it.
    stop: effectStep({
      reads: ['verdict', 'findings.read'],
      effects: (view) => {
        const plan = view.verdict || {};
        if (plan.proceed !== true) return [];
        if (!plan.target || plan.target.kind === 'none' || plan.target.pid == null) return [];
        return [{
          type: SHUTDOWN_EFFECT,
          payload: {
            pid: plan.target.pid,
            targetKind: plan.target.kind,
            baselineExitCount: view.findings.read.baselineExitCount,
            pollMs: POLL_INTERVAL_MS,
          },
        }];
      },
    }),

    // ── 4. sweep ──────────────────────────────────────────────────────────────────────────────────────────
    // The safety net for a lease an OLDER runner leaked (one built before the SIGTERM handler, or one
    // SIGKILLed past the supervisor's 5-second grace). Skipped entirely when the plan refused — a refused
    // restart must not go on to mutate lock state. NOT skipped when the shutdown went unconfirmed: the sink
    // only ever removes a provably stale lease, and reporting what is actually on disk is exactly what an
    // operator needs at that moment.
    sweep: effectStep({
      reads: ['verdict'],
      effects: (view) => ((view.verdict || {}).proceed === true ? [{ type: SWEEP_LEASE_EFFECT, payload: {} }] : []),
    }),

    // ── 5. gate ───────────────────────────────────────────────────────────────────────────────────────────
    // The last decision, and the only one reading BOTH effect findings. Kept a `compute` rather than folded
    // into the launch effect so a refusal is recorded as a finding an operator can read, not swallowed as an
    // empty effect list that looks identical to "nothing needed doing".
    gate: compute({
      reads: ['verdict', 'findings.stop', 'findings.sweep'],
      fn: (view) => gateStart({
        plan: view.verdict,
        shutdown: effectResult(view.findings.stop),
        sweep: effectResult(view.findings.sweep),
      }),
    }),

    // ── 6. start ──────────────────────────────────────────────────────────────────────────────────────────
    // One effect or zero — never two, because the whole singleton apparatus exists to keep it that way.
    start: effectStep({
      reads: ['findings.gate', 'input.checkout', 'input.supervisor'],
      effects: (view) => (view.findings.gate?.starting === true
        ? [{ type: START_SUPERVISOR_EFFECT, payload: { checkout: view.input.checkout, supervisor: view.input.supervisor } }]
        : []),
    }),
  });
}
