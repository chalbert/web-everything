/**
 * @file scripts/conveyor/resolve-runner-checkout.mjs
 * @description Resolves WHICH checkout the live conveyor runner is actually rooted in (WE #3478). The
 *   runner's singleton lease ({@link ../../skills-src/conveyor/runner-lock.mjs}) records the runner's `pid`
 *   but not its working directory, so a caller (e.g. {@link ./queue-work.mjs}) has no way to tell whether the
 *   sidecar it is about to write (`.conveyor/queue.json`, resolved by {@link ./queue-store.mjs} from the
 *   CALLER's own script location) is a checkout the runner is even reading from. This module closes that gap:
 *   read the runner-lock root, find the one LIVE lease, and derive its owning process's cwd via `lsof`.
 *
 * PURE / IMPURE split (mirrors file-locks.mjs): {@link classifyRunnerLocks} and {@link parseCwdFromLsof} take
 *   no fs/process input — a fixture list of lock entries / a captured `lsof` transcript drives them in tests.
 *   {@link readAllLockEntries} and {@link pidToCwd} are the thin impure shell; {@link resolveRunnerCheckout}
 *   orchestrates the two into one caller-facing verdict.
 *
 * Never assumes exactly one lock dir exists under the lock root: it enumerates EVERY dir there (not just the
 * runner's current fixed sentinel key) and classifies by liveness, so a corrupted/legacy lock root with more
 * than one live-looking entry is surfaced as `ambiguous` rather than silently picking one.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseLockEntry, isLeaseExpired, DEFAULT_LEASE_MINUTES } from '../readiness/file-locks.mjs';
import { RUNNER_LOCK_ROOT } from '../../skills-src/conveyor/runner-lock.mjs';

// ── PURE CORE (no fs / process — every input is injected) ──────────────────────────────────────────────────

/**
 * Classify a list of raw lock entries at `nowMs`: which are LIVE (heartbeat within the lease)?
 *   • zero live      → `{ status: 'no-live-lock' }` — no runner is driving; a caller must refuse/warn, never
 *     silently write to whatever checkout it happens to be in.
 *   • exactly one live → `{ status: 'resolved', entry }` — the authoritative runner lease.
 *   • more than one live → `{ status: 'ambiguous', live }` — which one is real cannot be told apart; a caller
 *     must surface the ambiguity, never guess.
 * @param {Array<{owner:string, pid:number|null, heartbeatAt:string}>} entries
 * @param {number} nowMs
 * @param {number} [leaseMinutes]
 */
export function classifyRunnerLocks(entries, nowMs, leaseMinutes = DEFAULT_LEASE_MINUTES) {
  const live = (Array.isArray(entries) ? entries : []).filter((e) => e && !isLeaseExpired(e, nowMs, leaseMinutes));
  if (live.length === 0) return { status: 'no-live-lock', live: [] };
  if (live.length > 1) return { status: 'ambiguous', live };
  return { status: 'resolved', live, entry: live[0] };
}

/**
 * Parse `lsof -a -p <pid> -d cwd -Fn` output for the process's current working directory — the SAME flags +
 * field-format `scripts/pr-status.mjs`'s `listLanes` already shells for lane-owner detection (reused here
 * rather than re-deriving pid→cwd resolution from scratch, per this item's own proposed-fix note). `-Fn`
 * emits one field per line prefixed by its letter (`p1234`, `nfoo/bar`); the `n`-prefixed line is the path,
 * with the prefix stripped. Returns `null` when no such line is found (unexpected output shape, or the
 * process has already exited).
 * @param {string} output
 * @returns {string|null}
 */
export function parseCwdFromLsof(output) {
  const line = String(output || '').split('\n').find((l) => l.startsWith('n'));
  return line ? line.slice(1) : null;
}

// ── THIN IMPURE SHELL ────────────────────────────────────────────────────────────────────────────────────

/**
 * Enumerate every lock entry under `lockRoot` (one subdirectory per hashed lock path — see
 * {@link ../readiness/file-locks.mjs}'s `lockIdFor`). Tolerant: a missing root, an unreadable dir, or a
 * corrupt `lock.json` is skipped rather than throwing (a torn lock entry must never wedge resolution).
 * @param {string} lockRoot
 * @returns {Array<{owner:string, pid:number|null, heartbeatAt:string}>}
 */
export function readAllLockEntries(lockRoot) {
  if (!existsSync(lockRoot)) return [];
  let dirs;
  try { dirs = readdirSync(lockRoot, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const d of dirs) {
    if (!d.isDirectory || !d.isDirectory()) continue;
    const file = join(lockRoot, d.name, 'lock.json');
    if (!existsSync(file)) continue;
    try {
      const entry = parseLockEntry(readFileSync(file, 'utf8'));
      if (entry) out.push(entry);
    } catch { /* corrupt entry — skip, never wedge resolution */ }
  }
  return out;
}

/** Default `lsof` shell-out for a pid — fail-soft (a host without `lsof`, or a pid already gone, returns ''
 *  rather than throwing), mirroring `scripts/pr-status.mjs`'s `sh` helper. */
function defaultLsof(pid) {
  try {
    return execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch { return ''; }
}

/**
 * Resolve `pid`'s current working directory via `lsof` (injectable for tests — `execFn(pid) -> string`).
 * Returns `null` on any failure (pid gone, `lsof` missing, unexpected output) rather than throwing — the
 * caller decides how to report an unresolved cwd.
 * @param {number} pid
 * @param {(pid:number)=>string} [execFn]
 * @returns {string|null}
 */
export function pidToCwd(pid, execFn = defaultLsof) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  let out;
  try { out = execFn(pid); } catch { return null; }
  return parseCwdFromLsof(out);
}

/**
 * Does a process's full command line look like the conveyor runner's own invocation? Heartbeat freshness alone
 * proves only that SOME process is alive at the recorded pid — not that it is still the runner (the OS can
 * reuse a pid once its original owner exits, inside the same lease window). This checks every whitespace-split
 * TOKEN of the command line for an EXACT match against the runner's script-path suffix — never a bare substring
 * of the whole line (accepts an unrelated process whose argv merely CONTAINS that text, e.g. a log path or a
 * flag value) and never a FIXED token position (breaks on an interpreter flag ahead of the script path, or a
 * path containing whitespace splitting the script-path token itself away from a preceding directory segment —
 * the whitespace still can't land INSIDE `skills-src/conveyor/runner.mjs`, so the trailing token carrying it
 * still matches). WE #3478 review, rounds 2 and 3: both a substring check and a fixed-position check were tried
 * and found to concede one of these two failure modes; scanning every token for the exact path-suffix concedes
 * neither against an ACCIDENTAL pid reuse (an unrelated, ordinary process). It does NOT defend a DELIBERATE
 * local attacker who plants a decoy file tree ending in exactly `skills-src/conveyor/runner.mjs` — that is a
 * different, local-filesystem-write threat model this item was never scoped to address.
 * @param {string} commandLine
 * @returns {boolean}
 */
export function looksLikeRunnerProcess(commandLine) {
  if (typeof commandLine !== 'string') return false;
  const tokens = commandLine.trim().split(/\s+/);
  return tokens.some((t) => t === 'skills-src/conveyor/runner.mjs' || t.endsWith('/skills-src/conveyor/runner.mjs'));
}

/** Default `ps` shell-out for a pid's full command line — fail-soft, mirroring {@link defaultLsof}. */
function defaultPs(pid) {
  try {
    return execFileSync('ps', ['-o', 'command=', '-p', String(pid)], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch { return ''; }
}

/**
 * Verify `pid`'s process identity actually looks like the conveyor runner (injectable for tests —
 * `execFn(pid) -> string`, the raw command-line text). A pid that fails this check is NOT trusted as the
 * runner even if its lock's heartbeat is fresh.
 * @param {number} pid
 * @param {(pid:number)=>string} [execFn]
 * @returns {boolean}
 */
export function verifyRunnerProcess(pid, execFn = defaultPs) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  let out;
  try { out = execFn(pid); } catch { return false; }
  return looksLikeRunnerProcess(out);
}

/**
 * The one caller-facing verdict: which checkout is the live conveyor runner actually rooted in?
 *   • `{ status: 'no-live-lock' }` — no live runner; a caller must refuse/warn, never guess a checkout.
 *   • `{ status: 'ambiguous', entries }` — more than one live-looking lease; cannot tell which is real.
 *   • `{ status: 'no-pid', owner }` — the live lease carries no pid to resolve.
 *   • `{ status: 'cwd-unresolved', owner, pid }` — `lsof` could not derive the pid's cwd.
 *   • `{ status: 'process-mismatch', owner, pid, cwd }` — the pid resolved to a cwd, but its command line does
 *     not look like the runner (a reused pid) — the cwd is reported for diagnostics only, never trusted.
 *   • `{ status: 'resolved', cwd, owner, pid, heartbeatAt }` — the runner's checkout, ready to use.
 * `lockRoot` defaults to the real machine-global runner-lock home ({@link RUNNER_LOCK_ROOT}), overridable by a
 * `CONVEYOR_RUNNER_LOCK_ROOT` env var (read here, not by each caller) so a test/ops caller can point at a
 * fixture root without ever touching the real one — the same override queue-work.mjs exposes on its CLI.
 *
 * ACCEPTED RESIDUAL: `pidToCwd` (lsof) and `verifyProcess` (ps) are two separate, non-atomic shell-outs against
 * the same pid — a pid reused by a new, unrelated process landing in the gap between them is not provable to
 * be impossible. `verifyProcess` closes the practical case this item exists to fix (an accidentally-reused pid
 * running an ordinary, unrelated process survives long enough to be read at all); it is not a transactional
 * guarantee, because no such guarantee exists for two shell commands run in sequence. A fully atomic single
 * read is a larger change than this item's scope (WE #3478 review).
 * @param {{lockRoot?:string, nowMs?:number, leaseMinutes?:number, execFn?:(pid:number)=>string, verifyProcess?:(pid:number)=>boolean}} [opts]
 */
export function resolveRunnerCheckout({
  lockRoot, nowMs = Date.now(), leaseMinutes = DEFAULT_LEASE_MINUTES, execFn, verifyProcess = verifyRunnerProcess,
} = {}) {
  const envRoot = process.env.CONVEYOR_RUNNER_LOCK_ROOT;
  const root = lockRoot || (envRoot && envRoot.trim()) || RUNNER_LOCK_ROOT;
  const entries = readAllLockEntries(root);
  const cls = classifyRunnerLocks(entries, nowMs, leaseMinutes);
  if (cls.status === 'no-live-lock') {
    return { status: 'no-live-lock', cwd: null, reason: 'no live conveyor runner lock found' };
  }
  if (cls.status === 'ambiguous') {
    return {
      status: 'ambiguous', cwd: null,
      reason: `${cls.live.length} live runner locks found — cannot tell which is authoritative`,
      entries: cls.live,
    };
  }
  const { entry } = cls;
  // A pid of exactly 0 is a valid integer but never a usable process id — treat it the same as a missing pid
  // (`no-pid`) rather than falling through to `pidToCwd`'s own `pid <= 0` guard, which would misreport the
  // more specific `cwd-unresolved` for what is really "no pid was ever recorded" (#3478 review, round 1).
  if (!Number.isInteger(entry.pid) || entry.pid <= 0) {
    return { status: 'no-pid', cwd: null, reason: 'the live runner lock has no pid recorded', owner: entry.owner };
  }
  const cwd = pidToCwd(entry.pid, execFn);
  if (!cwd) {
    return {
      status: 'cwd-unresolved', cwd: null,
      reason: `could not resolve the working directory for runner pid ${entry.pid}`,
      owner: entry.owner, pid: entry.pid,
    };
  }
  if (!verifyProcess(entry.pid)) {
    return {
      status: 'process-mismatch', cwd,
      reason: `pid ${entry.pid} resolved to a cwd but its process does not look like the conveyor runner — a reused pid is not trusted`,
      owner: entry.owner, pid: entry.pid,
    };
  }
  return { status: 'resolved', cwd, owner: entry.owner, pid: entry.pid, heartbeatAt: entry.heartbeatAt };
}
