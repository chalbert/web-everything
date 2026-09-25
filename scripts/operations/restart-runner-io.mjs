/**
 * @file scripts/operations/restart-runner-io.mjs
 * @description THE IO SHELL of the `restart-runner` declaration (#3383) — the reader that OBSERVES and the
 *   three sinks that ACT. Kept out of {@link ./restart-runner.mjs} for the reason `verify-io.mjs` is kept out
 *   of `verify.mjs`, and the reason bites harder here than anywhere else in this tree: that file's import
 *   graph is asserted free of `node:` specifiers, and this operation's verbs are SIGNAL A PROCESS and SPAWN
 *   ONE. Every killer and every spawner is in this file, so the declaration provably holds neither.
 *
 * ── THE SPLIT, AND WHY EACH PIECE SITS WHERE IT DOES ────────────────────────────────────────────────────────
 *
 * THE READER OBSERVES; THE DECLARATION DECIDES. `createRestartReader` answers four questions and judges none
 * of them: what is in the agent listing (each row pre-tagged with `buildItemNum` so the declaration never
 * needs a second copy of the `conveyor-<num>` grammar — a looser copy of that matcher is the #3283 incident),
 * what the lease says (pre-resolved into `expired`/`pidAlive`, because `isLeaseExpired` and `process.kill`
 * both live on this side), which process actually owns the loop, and how many exit rows the supervisor ledger
 * already had. Which window counts, and that a `'stale'` lease needs both signals, stay in the declaration.
 *
 * `--wait` LIVES IN THE READER, deliberately. Sitting out an active dispatch is a longer OBSERVATION, not a
 * decision: the reader polls until the listing is quiet or the deadline passes, then returns the final
 * observation plus `waitedMs`. The declaration judges that one observation exactly as it judges an unwaited
 * read — no loop, no clock and no sleep inside a `compute`.
 *
 * THE THREE SINKS, one per declared effect type, each performing exactly one verb:
 *   • `conveyor.runner-shutdown`   — SIGTERM the target, then wait for EVIDENCE ({@link confirmShutdown}).
 *   • `conveyor.stale-lease-sweep` — remove a leaked lease, and only a provably leaked one.
 *   • `conveyor.supervisor-start`  — launch a fresh detached supervisor.
 *
 * IMPURE by construction: subprocess, signals, fs, clock.
 */

import { execFileSync, spawn as nodeSpawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defaultListAgents } from './dispatch-lane-io.mjs';
import { itemNumFromSession } from '../conveyor/lease-reaper.mjs';
import { readLockEntry, releaseLockDir, isLeaseExpired } from '../readiness/file-locks.mjs';
import { RUNNER_LOCK_ROOT, RUNNER_LEASE_PATH, RUNNER_LEASE_MINUTES } from '../../skills-src/conveyor/runner-lock.mjs';
import {
  SHUTDOWN_EFFECT, SWEEP_LEASE_EFFECT, START_SUPERVISOR_EFFECT,
  SHUTDOWN_CONFIRM_TIMEOUT_MS, POLL_INTERVAL_MS, RECENT_SPAWN_WINDOW_MS, WAIT_TIMEOUT_MS,
} from './restart-runner.mjs';

/** The repo this file lives in — the default checkout a fresh supervisor starts in, and where its own
 *  `skills-src/conveyor/supervisor.mjs` is found. Resolved from THIS file, never from cwd. */
export const RESTART_REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The supervisor this repo ships. Overridable per call only so a test can point at an isolated copy. */
export const DEFAULT_SUPERVISOR_PATH = join(RESTART_REPO_ROOT, 'skills-src', 'conveyor', 'supervisor.mjs');

/** The supervisor's JSONL action ledger — the durable transcription of what it read off the runner's stdout
 *  (`we:skills-src/conveyor/supervisor.mjs#DEFAULT_LOG_PATH`). Re-derived from the lock root here rather than
 *  imported, so this shell does not pull the whole supervisor module in for one string; the suite asserts the
 *  spelling against the real file, so a rename there breaks a test rather than production. */
export const supervisorLogPath = (lockRoot = RUNNER_LOCK_ROOT) => join(lockRoot, 'supervisor-history.jsonl');

// ── liveness + process-tree primitives ─────────────────────────────────────────────────────────────────────

/** `kill(pid, 0)` — the standard liveness probe: it sends nothing and throws ESRCH when no such process
 *  exists. EPERM means the process EXISTS but belongs to another user, so that counts as ALIVE (the safe
 *  direction: we would rather decline to reap a lease than reap a live one). */
export function defaultIsPidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e?.code === 'EPERM'; }
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

/**
 * The process that actually owns the restart loop: the runner's SUPERVISOR parent when one is resident,
 * otherwise the bare runner itself.
 *
 * This matters more than it looks. The lease records the RUNNER's pid, and SIGTERMing only the runner is
 * counter-productive under a supervisor: the supervisor's whole job is to respawn a runner that exits, so the
 * "restart" would restart nothing — and the launch step would then start a SECOND supervisor racing the first.
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

// ── the ledger ─────────────────────────────────────────────────────────────────────────────────────────────

/** The `{event:'exit', ...}` rows of a supervisor JSONL ledger, in order. A malformed line is skipped, never
 *  fatal — the file is appended to by a live process and may be mid-write when we read it. */
export function parseExitEvents(text) {
  return String(text || '').split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter((e) => e && e.event === 'exit');
}

// ── the reader ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Tag one `claude agents --json` row with the answer the declaration needs and cannot compute purely: the
 * backlog item a `conveyor-<num>` BUILD session names, or `null` for every other session kind.
 *
 * Only `conveyor-*`. `fix-*` / `review-*` / `prepare-*` all match the same slug grammar, so the prefix test is
 * what keeps them out; the grammar itself goes through `lease-reaper.mjs#itemNumFromSession` rather than a
 * second, looser copy (#3283 — a bare `(\d+)$` match aliased `probe1` and `Mac:24827` onto real item numbers).
 */
export function tagAgentRow(row) {
  const name = String(row?.name ?? '');
  const isBuild = /^conveyor-/i.test(name);
  return {
    name,
    id: row?.id ?? null,
    startedAt: Number(row?.startedAt),
    buildItemNum: isBuild ? itemNumFromSession(name) : null,
  };
}

/**
 * ONE observation of everything the declaration decides over. Under `wait`, polls the listing until no recent
 * build spawn remains or `waitTimeoutMs` elapses — see the header for why waiting is a read, not a decision.
 *
 * Carries `listingReadable:false` rather than throwing: the declaration's `plan` step is where an unreadable
 * listing has to become a FAIL-CLOSED refusal, and a throw here would abort the run with no record of why.
 *
 * Both bounded waits in this file carry a poll CEILING as well as a deadline. The deadline is computed from
 * the injected clock, so a caller whose clock does not advance would otherwise spin forever with no
 * diagnosis — which is exactly what a first cut of this operation's tests did.
 *
 * `sleepSync`, not an async sleep: a `compute` step's fn is synchronous, so the reader it calls must be too.
 */
export function createRestartReader({
  lockRoot = RUNNER_LOCK_ROOT,
  listAgents = defaultListAgents,
  readLease = () => readLockEntry(lockRoot, RUNNER_LEASE_PATH),
  readLog = () => { try { return readFileSync(supervisorLogPath(lockRoot), 'utf8'); } catch { return ''; } },
  isPidAlive = defaultIsPidAlive,
  psRead = defaultPsRead,
  sleepSync = (ms) => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); },
  now = () => Date.now(),
  leaseMinutes = RUNNER_LEASE_MINUTES,
} = {}) {
  return ({ wait = false, windowMs = RECENT_SPAWN_WINDOW_MS, waitTimeoutMs = WAIT_TIMEOUT_MS, pollMs = POLL_INTERVAL_MS } = {}) => {
    const startedAt = now();
    const maxPolls = Math.max(1, Math.ceil(waitTimeoutMs / Math.max(1, pollMs)) + 2);

    let agents = [];
    let listingReadable = true;
    let listingError = null;
    for (let poll = 0; ; poll += 1) {
      try {
        const raw = listAgents();
        agents = (Array.isArray(raw) ? raw : []).map(tagAgentRow);
        listingReadable = true;
        listingError = null;
      } catch (e) {
        agents = [];
        listingReadable = false;
        listingError = String(e?.message ?? e).split('\n')[0];
        break;                            // a listing we cannot read will not become readable by waiting
      }
      if (!wait) break;
      const at = now();
      const stillHot = agents.some((a) => a.buildItemNum != null && at - a.startedAt >= 0 && at - a.startedAt < windowMs);
      if (!stillHot) break;
      if (at - startedAt >= waitTimeoutMs || poll >= maxPolls) break;
      sleepSync(pollMs);
    }

    const entry = readLease();
    const pid = Number.isFinite(Number(entry?.pid)) ? Number(entry.pid) : null;
    const observedAtMs = now();

    return {
      observedAtMs,
      waitedMs: observedAtMs - startedAt,
      listingReadable,
      listingError,
      agents,
      lease: entry
        ? {
          present: true,
          pid,
          owner: entry.owner ?? null,
          heartbeatAt: entry.heartbeatAt ?? null,
          // Pre-resolved HERE because both answers need this side: the TTL rule is `file-locks.mjs`'s and
          // liveness is a signal. The declaration decides what the PAIR means, never how either was read.
          expired: isLeaseExpired(entry, observedAtMs, leaseMinutes),
          pidAlive: pid === null ? null : isPidAlive(pid),
        }
        : { present: false, pid: null, owner: null, heartbeatAt: null, expired: false, pidAlive: null },
      target: pid === null ? { kind: 'none', pid: null, command: null } : resolveTarget({ pid, psRead }),
      // Counted BEFORE anything is signalled, so `confirmShutdown` waits for the ledger to GROW and a
      // pre-existing exit row from an earlier restart can never be mistaken for this run's confirmation.
      baselineExitCount: parseExitEvents(readLog()).length,
    };
  };
}

// ── sink 1: shut down, and confirm it by evidence ──────────────────────────────────────────────────────────

/**
 * Wait for EVIDENCE that the shutdown completed — never for a bare timeout.
 *
 * WHAT COUNTS AS EVIDENCE, strongest first:
 *
 *   (a) THE RUNNER'S OWN STDOUT EVENT, durably transcribed. `supervisor.mjs`'s `makeRealSpawnChild` parses
 *       `{event:'stopped', stoppedReason}` / `{event:'stood-down'}` off the runner's stdout, hands it to
 *       `classifyExit`, and writes the result to its JSONL ledger as `{event:'exit', kind, reason, signal,
 *       shutdownRequested}`. A NEW such row appearing after our signal — we count the rows first and wait for
 *       the count to GROW — is the runner's own account of why it stopped, read from the only place an
 *       out-of-band process can read it. `reason` is carried straight through to the caller.
 *
 *   (b) THE LEASE IS GONE AND THE PID IS DEAD. The fallback for a bare runner with no supervisor (no ledger
 *       exists), and the corroborating check in every case. Both together mean the shutdown handler ran: the
 *       lease release is the FIRST thing it does and the process dying is the last. The pid dying ALONE is
 *       explicitly not enough — that exact combination IS the leak this branch of work exists to fix.
 *
 * Returns `confirmed:false` with whatever it did observe rather than throwing: the caller decides whether to
 * escalate, and "the pid is gone but the lease is still held" is far more useful than a timeout.
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
  // A hard poll ceiling alongside the wall-clock deadline — see `createRestartReader`'s note for why.
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
    if (waitedMs >= timeoutMs || poll >= maxPolls) {
      return { confirmed: false, via: null, reason: null, leaseGone, pidAlive, waitedMs };
    }
    await sleep(pollMs);
  }
}

// ── sink 2: sweep a leaked lease ───────────────────────────────────────────────────────────────────────────

/**
 * Remove the singleton lease ONLY when it is provably leaked — a past-TTL heartbeat AND a dead pid, both.
 * Anything else is left exactly as found and REPORTED, so an operator sees why nothing was swept.
 *
 * The `state` returned here is the declaration's own `classifyLease` verdict, fed the same `expired`/
 * `pidAlive` pair the reader produces — the rule lives in one place and this sink APPLIES it rather than
 * restating it. It is injected (see {@link createRestartRunnerSinks}) rather than imported at the top of this
 * file, so the dependency is visible at the binding site.
 *
 * A safety net for a lease an OLDER runner leaked (one built before `installShutdownHandlers`, or one
 * SIGKILLed past the supervisor's 5-second grace), not a routine step: after a clean shutdown there is
 * nothing here to sweep, and the happy path reports `'none'`.
 */
export function sweepStaleLease({
  lockRoot = RUNNER_LOCK_ROOT,
  nowMs = Date.now(),
  readLease = () => readLockEntry(lockRoot, RUNNER_LEASE_PATH),
  release = () => releaseLockDir(lockRoot, RUNNER_LEASE_PATH),
  isPidAlive = defaultIsPidAlive,
  leaseMinutes = RUNNER_LEASE_MINUTES,
  classify,
} = {}) {
  if (typeof classify !== 'function') {
    throw new TypeError('restart-runner-io: sweepStaleLease needs the declaration\'s `classifyLease` — the lease rule has exactly one implementation');
  }
  const entry = readLease();
  const pid = Number.isFinite(Number(entry?.pid)) ? Number(entry.pid) : null;
  const lease = classify({
    present: !!entry,
    pid,
    owner: entry?.owner ?? null,
    heartbeatAt: entry?.heartbeatAt ?? null,
    expired: entry ? isLeaseExpired(entry, nowMs, leaseMinutes) : false,
    pidAlive: pid === null ? null : isPidAlive(pid),
  });

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
    detail: `swept a LEAKED lease: owner ${lease.owner}, pid ${lease.pid} is dead, heartbeat ${lease.heartbeatAt} is past the ${leaseMinutes}-minute TTL`,
  };
}

// ── sink 3: start fresh ────────────────────────────────────────────────────────────────────────────────────

/**
 * Launch a detached supervisor whose stdout/stderr land in a file under the lock root, where this process
 * family's local, machine-disposable state already lives. Detached and `unref`'d so the operation can exit
 * without taking the conveyor down with it — the whole point of restarting a RESIDENT process.
 *
 * The supervisor path is checked to EXIST before the spawn, because a detached child that fails to start
 * reports nothing back: without this, a typo'd path would report "started supervisor pid N" while leaving
 * nothing running at all.
 */
export function startSupervisor({
  supervisorPath = DEFAULT_SUPERVISOR_PATH,
  cwd = RESTART_REPO_ROOT,
  extraArgs = [],
  lockRoot = RUNNER_LOCK_ROOT,
  spawn = nodeSpawn,
  ensureDir = (d) => mkdirSync(d, { recursive: true }),
  openLog = (p) => openSync(p, 'a'),
  exists = existsSync,
} = {}) {
  const path = resolve(supervisorPath);
  if (!exists(path)) throw new Error(`restart-runner: no supervisor at ${path}`);
  ensureDir(lockRoot);
  const logPath = join(lockRoot, 'supervisor.out');
  const fd = openLog(logPath);
  const argv = [path, ...extraArgs];
  const child = spawn(process.execPath, argv, { cwd: resolve(cwd), detached: true, stdio: ['ignore', fd, fd] });
  if (typeof child.unref === 'function') child.unref();
  return { pid: child.pid, logPath, argv, cwd: resolve(cwd) };
}

// ── the sink table ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * The three sinks, one per declared effect type. The engine records each sink's return value as the step's
 * finding (`engine.mjs#effectFinding`), so the shutdown result and the sweep result reach the `gate` step
 * through the normal path — no second channel, and the declaration stays unable to reach the world.
 *
 * Everything in `io` is forwarded to all three, so ONE stub set drives the whole operation in a test.
 */
export function createRestartRunnerSinks({
  lockRoot = RUNNER_LOCK_ROOT,
  shutdownTimeoutMs = SHUTDOWN_CONFIRM_TIMEOUT_MS,
  classifyLease,
  supervisorPath = DEFAULT_SUPERVISOR_PATH,
  repoRoot = RESTART_REPO_ROOT,
  extraArgs = [],
  signal = (pid, sig) => process.kill(pid, sig),
  now = () => Date.now(),
  ...io
} = {}) {
  return {
    [SHUTDOWN_EFFECT]: async ({ pid, targetKind, baselineExitCount, pollMs = POLL_INTERVAL_MS } = {}) => {
      signal(pid, 'SIGTERM');
      const res = await confirmShutdown({ lockRoot, pid, baselineExitCount, timeoutMs: shutdownTimeoutMs, pollMs, ...io });
      // `attempted` is what lets the gate tell "we signalled and it never confirmed" (a refusal) apart from
      // "there was nothing to signal" (a plain start). Without it the two arrive indistinguishable.
      return { attempted: true, pid, targetKind, ...res };
    },

    [SWEEP_LEASE_EFFECT]: async () => sweepStaleLease({ lockRoot, nowMs: now(), classify: classifyLease, ...io }),

    [START_SUPERVISOR_EFFECT]: async ({ checkout = '', supervisor = '' } = {}) => startSupervisor({
      supervisorPath: supervisor || supervisorPath,
      cwd: checkout || repoRoot,
      extraArgs,
      lockRoot,
      ...io,
    }),
  };
}
