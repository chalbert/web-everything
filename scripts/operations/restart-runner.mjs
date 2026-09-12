#!/usr/bin/env node
/**
 * @file scripts/operations/restart-runner.mjs
 * @description RESTART THE CONVEYOR'S RESIDENT PROCESS SAFELY — the by-hand sequence from #3383's live-fire
 *   sessions, mechanized, in the same spirit (and the same plain-module shape) as its sibling
 *   `we:scripts/operations/dispatch-abort.mjs`: the operator kept doing the same four steps in the same order,
 *   and getting one of them wrong had real consequences.
 *
 * WHY A RESTART NEEDED MECHANIZING AT ALL. Until `we:skills-src/conveyor/runner.mjs` grew
 * `installShutdownHandlers`, a restart was simply unsafe: the runner had NO signal handlers, so any `kill`
 * leaked its singleton lease for the full 15-minute TTL and the fresh runner stood down instantly — which the
 * supervisor then scored as a crash. That is fixed, and this file is what the fix makes possible: with a clean
 * shutdown that actually releases the lease AND announces itself, a restart can be CONFIRMED rather than
 * hoped for.
 *
 * THE FOUR STEPS, and what each one is guarding against:
 *
 *   1. REFUSE UNDER A JUST-SPAWNED BUILD AGENT. The one genuine loss window. A `conveyor-<num>` build agent
 *      that `claude --bg` has spawned but that `claude agents --json` has not yet listed has NO durable floor
 *      anywhere: not in the listing, and not yet in whatever bookkeeping the next tick would read. Restart
 *      into that window and the new runner's in-flight guard cannot see the agent, so it dispatches the same
 *      item again — the double-dispatch the guards exist to prevent, at the one moment they are blind. So:
 *      any `conveyor-<num>` session younger than {@link RECENT_SPAWN_WINDOW_MS} is a REFUSAL (or, with
 *      `--wait`, a bounded wait until the youngest ages out).
 *
 *      NOTE WHAT THIS DOES *NOT* CLAIM. Seeing a recent spawn does not prove there is an unlisted one; it
 *      proves dispatch is ACTIVE right now, which is the only observable proxy for "another one may be
 *      mid-flight and invisible". The window is a cooling-off period, not a detector. Refusing is cheap (wait
 *      a minute); restarting into it is not (a duplicate delivery agent on a real lane).
 *
 *   2. SHUT DOWN CLEANLY, AND CONFIRM IT — SIGTERM to the process that actually owns the loop, then wait for
 *      EVIDENCE, never for a timeout. See {@link confirmShutdown} for what counts as evidence.
 *
 *   3. SWEEP A STALE LEASE. The safety net for a lease leaked by an OLDER runner (one built before the
 *      handler, or SIGKILLed past its grace) — without it a restart sits stood-down for up to 15 minutes
 *      waiting on a lock that nothing alive will ever release. Deliberately narrow: see {@link classifyLease}.
 *
 *   4. START FRESH, detached, with its output on disk.
 *
 * SIGNALS THE SUPERVISOR, NOT THE RUNNER, WHENEVER ONE IS RESIDENT ({@link resolveTarget}). The lease names
 * the RUNNER's pid, and SIGTERMing just the runner is worse than useless: its parent supervisor is a restart
 * loop, so it would dutifully spawn a replacement and the "restart" would have restarted nothing while this
 * operation went on to start a second, competing supervisor.
 *
 * IO IS INJECTED THROUGHOUT — `listAgents`, the lock-root reads, `isPidAlive`, `psRead`, `signal`, `spawn`,
 * `sleep`, `nowMs`. Every decision below is a pure function over facts someone else read. The `IS_CLI` block
 * at the bottom is the only part that touches the real `claude agents --json`, the real `~/.claude` lock root,
 * real signals and a real spawn — the same split `dispatch-abort.mjs` uses.
 */

import { execFileSync, spawn as nodeSpawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { flagValue } from './wake.mjs';
import { defaultListAgents } from './dispatch-lane-io.mjs';
import { itemNumFromSession } from '../conveyor/lease-reaper.mjs';
import { readLockEntry, releaseLockDir, isLeaseExpired } from '../readiness/file-locks.mjs';
import { RUNNER_LOCK_ROOT, RUNNER_LEASE_PATH, RUNNER_LEASE_MINUTES } from '../../skills-src/conveyor/runner-lock.mjs';
import { writeAllSync, writeLineSync } from '../lib/write-all-sync.mjs';

/** A `conveyor-<num>` session younger than this is treated as "dispatch is active right now, and a sibling
 *  spawn may not be listed yet". 60 s is the operator's own figure from the 2026-09-12 investigation, and it
 *  comfortably covers the gap between `claude --bg` returning a handle and the session appearing in a
 *  listing. Exported so a caller (and the tests) pin the number rather than restate it. */
export const RECENT_SPAWN_WINDOW_MS = 60_000;

/** How long {@link confirmShutdown} will wait for EVIDENCE of a clean exit before giving up and saying so. The
 *  supervisor's own SIGTERM→SIGKILL grace on its child is 5 s, so a clean shutdown is normally sub-second;
 *  this is sized for a runner that has to finish a blocking mechanical pass first. */
export const SHUTDOWN_CONFIRM_TIMEOUT_MS = 90_000;

/** Poll cadence for every bounded wait here. Short enough to feel instant, long enough not to spin. */
export const POLL_INTERVAL_MS = 500;

/** The supervisor's JSONL action ledger — the durable transcription of what it read off the runner's stdout
 *  (`we:skills-src/conveyor/supervisor.mjs#DEFAULT_LOG_PATH`, re-derived from the lock root here rather than
 *  imported, so this operation does not pull the whole supervisor module in just for one path). */
export const supervisorLogPath = (lockRoot = RUNNER_LOCK_ROOT) => join(lockRoot, 'supervisor-history.jsonl');

// ── step 1: refuse under a just-spawned build agent ──────────────────────────────────────────────────────

/**
 * The `conveyor-<num>` BUILD sessions spawned within `windowMs` of `nowMs`.
 *
 * Only `conveyor-*` — not `fix-*`, `prepare-*`, `review-*`. The loss window this guards is specifically a
 * DELIVERY dispatch whose lane lease and in-flight guard are still settling; the others either re-derive
 * their own state from GitHub labels on the next pass (fix/review) or write no lane lease at all (prepare).
 * Widening this would make the refusal fire constantly on a busy board for no added safety.
 *
 * The `conveyor-<num>` grammar is NOT re-derived here: it goes through `lease-reaper.mjs#itemNumFromSession`,
 * the one place that grammar lives, plus an explicit prefix test to keep the other three kinds out. (#3283 is
 * the incident that made a second, looser copy of this matcher a thing to avoid.)
 *
 * @param {object[]} agents - a `claude agents --json` listing (`{name, id, startedAt}` per row).
 * @param {{nowMs?: number, windowMs?: number}} [o]
 * @returns {{name: string, id: string|null, ageMs: number}[]} youngest first.
 */
export function recentBuildSpawns(agents, { nowMs = Date.now(), windowMs = RECENT_SPAWN_WINDOW_MS } = {}) {
  return (Array.isArray(agents) ? agents : [])
    .filter((a) => a && typeof a === 'object')
    .filter((a) => /^conveyor-/i.test(String(a.name ?? '')) && itemNumFromSession(a.name) !== null)
    .map((a) => ({ name: String(a.name), id: a.id ?? null, ageMs: nowMs - Number(a.startedAt) }))
    // A row whose `startedAt` is missing/garbage yields NaN, and `NaN < windowMs` is false — so it is treated
    // as OLD, not recent. That is the right direction: an unreadable timestamp must not be able to wedge every
    // restart forever, and the lease/guard checks downstream still protect the actual dispatch.
    .filter((r) => r.ageMs >= 0 && r.ageMs < windowMs)
    .sort((a, b) => a.ageMs - b.ageMs);
}

// ── the lease: live, stale, or absent ────────────────────────────────────────────────────────────────────

/**
 * What the singleton lease on disk actually means right now — the ONE place this operation decides it.
 *
 * `'stale'` requires BOTH signals to agree: the heartbeat is past the TTL *and* the recorded pid is not alive.
 * Either alone is unsafe to act on. A past-TTL heartbeat by itself can just be a runner wedged inside a long
 * blocking pass — killing its lease hands the singleton right to a second runner while the first is still
 * driving, which is the exact double-dispatch the lease exists to prevent. A dead pid by itself is not proof
 * either, in the other direction: pids are reused, so a live-looking pid may belong to something unrelated.
 * Requiring the intersection makes a false `'stale'` need two independent things to be wrong at once.
 *
 * @param {object|null} entry - `readLockEntry(lockRoot, RUNNER_LEASE_PATH)`.
 * @param {{nowMs?: number, leaseMinutes?: number, isPidAlive?: (pid: number) => boolean}} [o]
 * @returns {{state: 'none'|'live'|'stale', pid: number|null, owner: string|null, heartbeatAt: string|null, pidAlive: boolean|null, expired: boolean}}
 */
export function classifyLease(entry, { nowMs = Date.now(), leaseMinutes = RUNNER_LEASE_MINUTES, isPidAlive = defaultIsPidAlive } = {}) {
  if (!entry) return { state: 'none', pid: null, owner: null, heartbeatAt: null, pidAlive: null, expired: false };
  const pid = Number.isFinite(Number(entry.pid)) ? Number(entry.pid) : null;
  const expired = isLeaseExpired(entry, nowMs, leaseMinutes);
  const pidAlive = pid === null ? null : isPidAlive(pid);
  const state = expired && pidAlive === false ? 'stale' : 'live';
  return { state, pid, owner: entry.owner ?? null, heartbeatAt: entry.heartbeatAt ?? null, pidAlive, expired };
}

/** `kill(pid, 0)` — the standard liveness probe: it sends nothing and throws ESRCH when no such process
 *  exists. EPERM means the process EXISTS but belongs to another user, so that counts as ALIVE (the safe
 *  direction: we would rather decline to reap a lease than reap a live one). */
export function defaultIsPidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e?.code === 'EPERM'; }
}

// ── step 1 + preconditions, as one decision ──────────────────────────────────────────────────────────────

/**
 * Should the restart proceed right now? Pure over already-read facts, so the whole refusal policy is testable
 * without a process, a signal, or a CLI.
 * @param {{agents?: object[], lease?: object, nowMs?: number, windowMs?: number}} o
 * @returns {{proceed: boolean, refusal: string|null, recent: object[]}}
 */
export function planRestart({ agents = [], lease = { state: 'none' }, nowMs = Date.now(), windowMs = RECENT_SPAWN_WINDOW_MS } = {}) {
  const recent = recentBuildSpawns(agents, { nowMs, windowMs });
  if (recent.length) {
    const names = recent.map((r) => `${r.name} (${Math.round(r.ageMs / 1000)}s ago)`).join(', ');
    return {
      proceed: false,
      recent,
      refusal: `restart-runner: REFUSING — ${recent.length} build agent(s) spawned in the last ${Math.round(windowMs / 1000)}s: ${names}. `
        + 'A just-spawned dispatch has no durable floor yet, so restarting now risks a double-dispatch. '
        + `Wait for it to age out (\`--wait\` does that for you), or pass \`--force\` if you know the dispatch is settled.`,
    };
  }
  // No lease and no recent spawn ⇒ nothing is driving; this degenerates to a plain start, which is fine and
  // is reported as such rather than refused (`lease.state === 'none'` is handled by the caller).
  return { proceed: true, refusal: null, recent };
}

// ── step 2: who to signal ────────────────────────────────────────────────────────────────────────────────

/**
 * The process that actually owns the restart loop: the runner's SUPERVISOR parent when one is resident,
 * otherwise the bare runner itself.
 *
 * This matters more than it looks. The lease records the RUNNER's pid, and SIGTERMing only the runner is
 * counter-productive under a supervisor: the supervisor's whole job is to respawn a runner that exits, so the
 * "restart" would restart nothing — and step 4 would then start a SECOND supervisor racing the first.
 *
 * @param {{pid: number|null, psRead?: (pid: number) => {ppid: number|null, command: string}|null}} o
 * @returns {{kind: 'supervisor'|'runner'|'none', pid: number|null, command: string|null}}
 */
export function resolveTarget({ pid, psRead = defaultPsRead } = {}) {
  if (!Number.isFinite(Number(pid))) return { kind: 'none', pid: null, command: null };
  const runner = psRead(Number(pid));
  if (!runner) return { kind: 'none', pid: null, command: null };
  const parent = runner.ppid ? psRead(runner.ppid) : null;
  if (parent && /supervisor\.mjs/.test(parent.command || '')) {
    return { kind: 'supervisor', pid: runner.ppid, command: parent.command };
  }
  return { kind: 'runner', pid: Number(pid), command: runner.command };
}

/** `ps -o ppid=,command= -p <pid>` → `{ppid, command}`, or null when the pid is gone. */
export function defaultPsRead(pid, { exec = execFileSync } = {}) {
  try {
    const out = String(exec('ps', ['-o', 'ppid=,command=', '-p', String(pid)], { encoding: 'utf8', timeout: 10_000 })).trim();
    if (!out) return null;
    const m = out.match(/^\s*(\d+)\s+(.*)$/);
    return m ? { ppid: Number(m[1]), command: m[2] } : null;
  } catch { return null; }
}

// ── step 2: the evidence a clean shutdown actually happened ──────────────────────────────────────────────

/** The `{event:'exit', ...}` rows of a supervisor JSONL ledger, in order. Malformed lines are skipped, never
 *  fatal — this file is appended to by a live process and may be mid-write when we read it. */
export function parseExitEvents(text) {
  return String(text || '').split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter((e) => e && e.event === 'exit');
}

/**
 * Wait for EVIDENCE that the shutdown completed — never for a bare timeout.
 *
 * WHAT COUNTS AS EVIDENCE, strongest first:
 *
 *   (a) THE RUNNER'S OWN STDOUT EVENT, durably transcribed. `supervisor.mjs`'s `makeRealSpawnChild` parses
 *       `{event:'stopped', stoppedReason}` / `{event:'stood-down'}` off the runner's stdout, hands it to
 *       `classifyExit`, and writes the result to its JSONL ledger as `{event:'exit', kind, reason, signal,
 *       shutdownRequested}`. A NEW such row appearing after our signal (we count the rows first, and wait for
 *       the count to grow) is the runner's own account of why it stopped — which is exactly what "read the
 *       actual stdout event, not just a timeout" asks for, read from the only place an out-of-band process
 *       can read it. `reason` is carried straight through to the caller's report.
 *
 *   (b) THE LEASE IS GONE AND THE PID IS DEAD. The fallback for a bare runner with no supervisor (no ledger
 *       exists), and the corroborating check in every case. Both together mean the shutdown handler ran: the
 *       lease release is the FIRST thing it does, and the process dying is the last.
 *
 * Returns `confirmed:false` with whatever it did observe rather than throwing — the caller decides whether to
 * escalate, and reporting "the pid is gone but the lease is still there" is far more useful than a timeout.
 *
 * @returns {Promise<{confirmed: boolean, via: 'exit-event'|'lease-and-pid'|null, reason: string|null, leaseGone: boolean, pidAlive: boolean, waitedMs: number}>}
 */
export async function confirmShutdown({
  lockRoot = RUNNER_LOCK_ROOT,
  pid,
  baselineExitCount = 0,
  timeoutMs = SHUTDOWN_CONFIRM_TIMEOUT_MS,
  pollMs = POLL_INTERVAL_MS,
  readLease = () => readLockEntry(lockRoot, RUNNER_LEASE_PATH),
  readLog = () => { try { return readFileSync(supervisorLogPath(lockRoot), 'utf8'); } catch { return ''; } },
  isPidAlive = defaultIsPidAlive,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  nowMs = () => Date.now(),
} = {}) {
  const startedAt = nowMs();
  // A hard poll ceiling alongside the wall-clock deadline. The deadline alone is not enough: it is computed
  // from the INJECTED clock, so a caller whose clock does not advance (a frozen test clock, a stubbed `now`)
  // turns this into a tight infinite loop with no diagnosis — which is exactly what happened while writing
  // this file's own tests. Sized generously from the timeout so it never fires on a real, advancing clock.
  const maxPolls = Math.max(1, Math.ceil(timeoutMs / Math.max(1, pollMs)) + 2);
  for (let poll = 0; ; poll += 1) {
    const events = parseExitEvents(readLog());
    const leaseGone = readLease() === null;
    const pidAlive = Number.isFinite(Number(pid)) ? isPidAlive(Number(pid)) : false;
    const waitedMs = nowMs() - startedAt;

    if (events.length > baselineExitCount) {
      const latest = events[events.length - 1];
      return { confirmed: true, via: 'exit-event', reason: latest.reason ?? null, leaseGone, pidAlive, waitedMs };
    }
    if (leaseGone && !pidAlive) {
      return { confirmed: true, via: 'lease-and-pid', reason: null, leaseGone, pidAlive, waitedMs };
    }
    if (waitedMs >= timeoutMs || poll >= maxPolls) return { confirmed: false, via: null, reason: null, leaseGone, pidAlive, waitedMs };
    await sleep(pollMs);
  }
}

// ── step 3: the stale-lease sweep ────────────────────────────────────────────────────────────────────────

/**
 * Remove the singleton lease ONLY when {@link classifyLease} says `'stale'` — a past-TTL heartbeat AND a dead
 * pid, both. Anything else is left exactly as found and reported, so an operator sees WHY nothing was swept.
 *
 * This is a safety net for a lease an OLDER runner leaked (one built before `installShutdownHandlers`, or one
 * SIGKILLed past the supervisor's 5-second grace), not a routine step: after a clean shutdown there is
 * nothing here to sweep, and the happy path reports `'none'`.
 *
 * @returns {{swept: boolean, state: string, detail: string}}
 */
export function sweepStaleLease({
  lockRoot = RUNNER_LOCK_ROOT,
  nowMs = Date.now(),
  readLease = () => readLockEntry(lockRoot, RUNNER_LEASE_PATH),
  release = () => releaseLockDir(lockRoot, RUNNER_LEASE_PATH),
  isPidAlive = defaultIsPidAlive,
} = {}) {
  const entry = readLease();
  const lease = classifyLease(entry, { nowMs, isPidAlive });
  if (lease.state === 'none') return { swept: false, state: 'none', detail: 'no lease on disk — nothing to sweep' };
  if (lease.state === 'live') {
    return {
      swept: false,
      state: 'live',
      detail: `lease held by ${lease.owner} (pid ${lease.pid}${lease.pidAlive ? ', ALIVE' : ''}, heartbeat ${lease.heartbeatAt})`
        + ' — left alone: a sweep needs BOTH a past-TTL heartbeat and a dead pid',
    };
  }
  release();
  return {
    swept: true,
    state: 'stale',
    detail: `swept a LEAKED lease: owner ${lease.owner}, pid ${lease.pid} is dead, heartbeat ${lease.heartbeatAt} is past the ${RUNNER_LEASE_MINUTES}-minute TTL`,
  };
}

// ── step 4: start fresh ──────────────────────────────────────────────────────────────────────────────────

/**
 * Launch a detached supervisor whose stdout/stderr land in a file under the lock root (where this process
 * family's local, machine-disposable state already lives). Detached + `unref`'d so the restart operation can
 * exit without taking the conveyor down with it — the whole point of restarting a RESIDENT process.
 * @returns {{pid: number|undefined, logPath: string, argv: string[]}}
 */
export function startSupervisor({
  supervisorPath,
  cwd = process.cwd(),
  extraArgs = [],
  lockRoot = RUNNER_LOCK_ROOT,
  spawn = nodeSpawn,
  ensureDir = (d) => mkdirSync(d, { recursive: true }),
  openLog = (p) => openSync(p, 'a'),
} = {}) {
  if (!supervisorPath) throw new Error('restart-runner: startSupervisor needs a supervisorPath');
  ensureDir(lockRoot);
  const logPath = join(lockRoot, 'supervisor.out');
  const fd = openLog(logPath);
  const argv = [supervisorPath, ...extraArgs];
  const child = spawn(process.execPath, argv, { cwd, detached: true, stdio: ['ignore', fd, fd] });
  if (typeof child.unref === 'function') child.unref();
  return { pid: child.pid, logPath, argv };
}

// ── the composition ──────────────────────────────────────────────────────────────────────────────────────

/**
 * The four steps, in order, each reporting a line. Returns rather than prints, so a caller (and the tests)
 * get structured facts and the CLI owns the formatting.
 *
 * `--wait` polls step 1's refusal until the youngest recent spawn ages out of the window, bounded by
 * `waitTimeoutMs`; without it a recent spawn is a plain refusal. `--force` skips step 1 entirely and says so
 * on the report — it is for the operator who already knows the dispatch settled, not a way to un-see a
 * refusal.
 *
 * @returns {Promise<{ok: boolean, steps: string[], refusal: string|null, shutdown: object|null, sweep: object|null, started: object|null}>}
 */
export async function restartRunner({
  supervisorPath,
  cwd = process.cwd(),
  extraArgs = [],
  lockRoot = RUNNER_LOCK_ROOT,
  force = false,
  wait = false,
  waitTimeoutMs = 5 * 60_000,
  windowMs = RECENT_SPAWN_WINDOW_MS,
  shutdownTimeoutMs = SHUTDOWN_CONFIRM_TIMEOUT_MS,
  pollMs = POLL_INTERVAL_MS,
  listAgents = defaultListAgents,
  readLease = () => readLockEntry(lockRoot, RUNNER_LEASE_PATH),
  readLog = () => { try { return readFileSync(supervisorLogPath(lockRoot), 'utf8'); } catch { return ''; } },
  releaseLease = () => releaseLockDir(lockRoot, RUNNER_LEASE_PATH),
  isPidAlive = defaultIsPidAlive,
  psRead = defaultPsRead,
  signal = (pid, sig) => process.kill(pid, sig),
  spawn = nodeSpawn,
  ensureDir,
  openLog,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = () => Date.now(),
} = {}) {
  const steps = [];
  const report = (ok, extra = {}) => ({ ok, steps, refusal: null, shutdown: null, sweep: null, started: null, ...extra });

  // ── 1. refuse (or wait) under a just-spawned build agent ────────────────────────────────────────────────
  if (force) {
    steps.push('1. recent-spawn guard SKIPPED (--force) — the operator asserts no dispatch is mid-flight');
  } else {
    const deadline = now() + waitTimeoutMs;
    // Poll ceiling as well as a deadline, for the same reason `confirmShutdown` carries one: a caller whose
    // injected clock does not advance must still terminate.
    const maxPolls = Math.max(1, Math.ceil(waitTimeoutMs / Math.max(1, pollMs)) + 2);
    for (let poll = 0; ; poll += 1) {
      // A listing we cannot read fails CLOSED. The guard's entire value is knowing whether a dispatch just
      // happened; proceeding on "I couldn't tell" would silently convert the one refusal that matters into a
      // no-op, which is how a fail-open guard becomes worse than no guard.
      let agents;
      try { agents = listAgents(); } catch (e) {
        return report(false, { refusal: `restart-runner: REFUSING — could not read \`claude agents --json\` (${String(e?.message ?? e).split('\n')[0]}). The recent-spawn guard cannot be evaluated, so this fails closed. Re-run, or pass --force if you know no dispatch is in flight.` });
      }
      const plan = planRestart({ agents, nowMs: now(), windowMs });
      if (plan.proceed) { steps.push('1. recent-spawn guard PASSED — no `conveyor-<num>` session younger than the window'); break; }
      if (!wait) return report(false, { refusal: plan.refusal });
      if (now() >= deadline || poll >= maxPolls) {
        return report(false, { refusal: `${plan.refusal}\nrestart-runner: --wait gave up after ${Math.round(waitTimeoutMs / 1000)}s — dispatch is still active.` });
      }
      steps.push(`1. waiting — youngest build agent is ${Math.round(plan.recent[0].ageMs / 1000)}s old (window ${Math.round(windowMs / 1000)}s)`);
      await sleep(pollMs);
    }
  }

  // ── 2. clean shutdown, confirmed ────────────────────────────────────────────────────────────────────────
  const lease = classifyLease(readLease(), { nowMs: now(), isPidAlive });
  let shutdown = null;
  if (lease.state === 'none') {
    steps.push('2. nothing to stop — no singleton lease on disk');
  } else {
    const target = resolveTarget({ pid: lease.pid, psRead });
    if (target.kind === 'none') {
      steps.push(`2. nothing to stop — the lease names pid ${lease.pid}, which is already gone (its lease is swept in step 3)`);
    } else {
      // Counted BEFORE the signal: `confirmShutdown` waits for the ledger to GROW, so a pre-existing exit row
      // from an earlier restart can never be mistaken for this one's confirmation.
      const baselineExitCount = parseExitEvents(readLog()).length;
      signal(target.pid, 'SIGTERM');
      steps.push(`2. SIGTERM → ${target.kind} pid ${target.pid}`);
      shutdown = await confirmShutdown({
        lockRoot, pid: target.pid, baselineExitCount, timeoutMs: shutdownTimeoutMs, pollMs,
        readLease, readLog, isPidAlive, sleep, nowMs: now,
      });
      if (!shutdown.confirmed) {
        return report(false, {
          shutdown,
          refusal: `restart-runner: REFUSING TO START — the shutdown was never confirmed after ${Math.round(shutdown.waitedMs / 1000)}s `
            + `(lease ${shutdown.leaseGone ? 'released' : 'STILL HELD'}, pid ${target.pid} ${shutdown.pidAlive ? 'STILL ALIVE' : 'gone'}). `
            + 'Starting a second one now would race the first. Investigate before retrying.',
        });
      }
      steps.push(shutdown.via === 'exit-event'
        ? `2. shutdown CONFIRMED via the runner's own exit event (reason: ${shutdown.reason ?? 'unreported'}) after ${shutdown.waitedMs}ms`
        : `2. shutdown CONFIRMED — lease released and pid ${target.pid} gone after ${shutdown.waitedMs}ms`);
    }
  }

  // ── 3. sweep a leaked lease ─────────────────────────────────────────────────────────────────────────────
  const sweep = sweepStaleLease({ lockRoot, nowMs: now(), readLease, release: releaseLease, isPidAlive });
  steps.push(`3. ${sweep.detail}`);
  if (sweep.state === 'live' && !sweep.swept) {
    return report(false, { shutdown, sweep, refusal: `restart-runner: REFUSING TO START — a LIVE lease is still held (${sweep.detail}). A fresh runner would stand down against it.` });
  }

  // ── 4. start fresh ──────────────────────────────────────────────────────────────────────────────────────
  // `ensureDir`/`openLog` are forwarded ONLY when a caller supplied them, so `startSupervisor`'s own real-fs
  // defaults stay in force for the CLI (passing `undefined` explicitly would still select the default, but
  // spelling it this way keeps the seam obvious).
  const started = startSupervisor({ supervisorPath, cwd, extraArgs, lockRoot, spawn, ...(ensureDir ? { ensureDir } : {}), ...(openLog ? { openLog } : {}) });
  steps.push(`4. started supervisor pid ${started.pid} (output → ${started.logPath})`);
  return report(true, { shutdown, sweep, started });
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const argv = process.argv.slice(2);
  const flag = (name) => flagValue(argv, name);
  const HERE = dirname(fileURLToPath(import.meta.url));
  const REPO = resolve(HERE, '..', '..');
  // Everything this operation does not consume itself rides through to the supervisor (which in turn forwards
  // the runner's own flags) — the same "never learn a second copy of the child's flag surface" rule
  // `supervisor.mjs`'s own `OWN_FLAGS` follows.
  const OWN = new Set(['force', 'wait', 'window-ms', 'shutdown-timeout-ms', 'cwd', 'supervisor']);
  const extraArgs = argv.filter((a) => !(a.startsWith('--') && OWN.has(a.slice(2).split('=')[0])));

  const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
  const supervisorPath = flag('supervisor') ? resolve(flag('supervisor')) : join(REPO, 'skills-src', 'conveyor', 'supervisor.mjs');
  // Checked HERE rather than discovered at spawn time: a detached child that fails to start reports nothing
  // back to us, so a typo'd path would otherwise print "started supervisor pid N" and leave nothing running.
  if (!existsSync(supervisorPath)) {
    writeLineSync(2, `error: no supervisor at ${supervisorPath}`);
    process.exitCode = 1;
  } else restartRunner({
    supervisorPath,
    cwd: flag('cwd') ? resolve(flag('cwd')) : REPO,
    extraArgs,
    force: flag('force') !== undefined,
    wait: flag('wait') !== undefined,
    windowMs: num(flag('window-ms'), RECENT_SPAWN_WINDOW_MS),
    shutdownTimeoutMs: num(flag('shutdown-timeout-ms'), SHUTDOWN_CONFIRM_TIMEOUT_MS),
  }).then((res) => {
    writeAllSync(1, res.steps.map((s) => `restart-runner: ${s}\n`).join(''));
    if (res.refusal) { writeLineSync(2, res.refusal); process.exitCode = 1; }
  }).catch((e) => {
    writeLineSync(2, `error: ${String(e?.message ?? e)}`);
    process.exitCode = 1;
  });
}
