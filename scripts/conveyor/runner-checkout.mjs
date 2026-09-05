/**
 * @file scripts/conveyor/runner-checkout.mjs
 * @description Resolves which checkout the LIVE conveyor runner is actually rooted in (WE #3478). The
 *   runner-singleton lease ({@link ../../skills-src/conveyor/runner-lock.mjs}) names a `pid`, not a working
 *   directory, so a caller that wants to write into the runner's OWN `.conveyor/queue.json` sidecar must
 *   first turn that `pid` into a `cwd` — the by-hand `lsof -p <pid> | grep cwd` step the #3478 incident
 *   needed and no tooling performed. This module is that resolution, split PURE decision / thin IO shell
 *   (mirrors {@link ../readiness/file-locks.mjs}):
 *
 *   • {@link resolveRunnerPid} — pure: given the lock entries found under the runner lock root, decide
 *     which single `pid` (if any) is the one LIVE runner. `no-live-runner` when none are live, `ambiguous`
 *     when more than one is (the runner lock is a machine-wide singleton today, so this should never
 *     happen in practice — this module treats it as a real, surfaced refusal rather than an assumption).
 *   • {@link liveLockEntries} / {@link pidCwd} — thin IO: read every lock entry under the lock root, and
 *     shell `lsof` to turn a pid into its `cwd`.
 *   • {@link resolveLiveRunnerCwd} — the orchestrator a caller actually uses; injectable so the decision
 *     logic is testable without a real runner process or a real lock directory.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { parseLockEntry, isLeaseExpired, DEFAULT_LEASE_MINUTES } from '../readiness/file-locks.mjs';
import { RUNNER_LOCK_ROOT } from '../../skills-src/conveyor/runner-lock.mjs';

// ── pure decision ────────────────────────────────────────────────────────────────

/**
 * Which single pid, if any, is the one LIVE runner? Pure — the caller reads the entries and the clock.
 * @param {Array<{pid:number|null, heartbeatAt:string}>} entries
 * @param {number} nowMs
 * @param {number} [leaseMinutes]
 * @returns {{ok:true, pid:number} | {ok:false, reason:'no-live-runner'} | {ok:false, reason:'ambiguous', pids:number[]}}
 */
export function resolveRunnerPid(entries, nowMs, leaseMinutes = DEFAULT_LEASE_MINUTES) {
  const live = (Array.isArray(entries) ? entries : [])
    .filter((e) => e && Number.isInteger(e.pid) && !isLeaseExpired(e, nowMs, leaseMinutes));
  if (live.length === 0) return { ok: false, reason: 'no-live-runner' };
  const pids = [...new Set(live.map((e) => e.pid))];
  if (pids.length > 1) return { ok: false, reason: 'ambiguous', pids };
  return { ok: true, pid: pids[0] };
}

// ── thin IO shell ────────────────────────────────────────────────────────────────

/** Every lock entry found under `lockRoot` (one dir per lock key — today the runner lease is a single fixed
 *  sentinel key, but this scans every dir so a future multi-key lock root is handled the same way). Never
 *  throws: a missing root or a corrupt entry is skipped rather than wedging the resolve. */
export function liveLockEntries(lockRoot = RUNNER_LOCK_ROOT) {
  if (!existsSync(lockRoot)) return [];
  let dirs;
  try { dirs = readdirSync(lockRoot); } catch { return []; }
  const out = [];
  for (const d of dirs) {
    const file = join(lockRoot, d, 'lock.json');
    if (!existsSync(file)) continue;
    try {
      const entry = parseLockEntry(readFileSync(file, 'utf8'));
      if (entry) out.push(entry);
    } catch { /* corrupt entry — never wedge the resolve */ }
  }
  return out;
}

/** The working directory of a running `pid`, or `null` if it can't be resolved (the pid is gone, `lsof` is
 *  unavailable, or its cwd isn't readable). `lsof -a -d cwd -Fn` — confirmed working for this in the #3478
 *  incident — prints a `p<pid>` line then an `n<path>` line for the cwd file descriptor; `-Fn` gives just the
 *  name lines so parsing needs no field-header stripping beyond the leading `n`. */
export function pidCwd(pid) {
  try {
    const out = execFileSync('lsof', ['-p', String(pid), '-a', '-d', 'cwd', '-Fn'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    const line = out.split('\n').find((l) => l.startsWith('n'));
    return line ? line.slice(1).trim() || null : null;
  } catch { return null; }
}

/**
 * Resolve the checkout the live conveyor runner is rooted in. `ok:false` never throws and never guesses —
 * the caller (queue-work.mjs) turns a `reason` into a loud refusal rather than silently writing to the
 * wrong sidecar.
 * @returns {{ok:true, pid:number, checkout:string} | {ok:false, reason:string, pids?:number[], pid?:number}}
 */
export function resolveLiveRunnerCwd({
  lockRoot = process.env.CONVEYOR_RUNNER_LOCK_ROOT || RUNNER_LOCK_ROOT,
  nowMs = Date.now(),
  leaseMinutes = DEFAULT_LEASE_MINUTES,
  listEntries = () => liveLockEntries(lockRoot),
  resolveCwd = pidCwd,
} = {}) {
  const decision = resolveRunnerPid(listEntries(), nowMs, leaseMinutes);
  if (!decision.ok) return decision;
  const checkout = resolveCwd(decision.pid);
  if (!checkout) return { ok: false, reason: 'cwd-unresolvable', pid: decision.pid };
  return { ok: true, pid: decision.pid, checkout };
}
