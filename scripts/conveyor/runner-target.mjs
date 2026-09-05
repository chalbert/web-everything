#!/usr/bin/env node
/**
 * @file scripts/conveyor/runner-target.mjs
 * @description Resolves WHICH checkout's `.conveyor/queue.json` sidecar the LIVE conveyor runner actually
 *   reads from (WE #3478) — the gap `queue.mjs` leaves open: it always writes into whatever checkout its own
 *   script file happens to live in ({@link ./queue-store.mjs}'s `QUEUE_ROOT`), never checking whether that is
 *   the checkout the runner ({@link ../../skills-src/conveyor/runner.mjs}) is actually rooted in.
 *
 * The runner-singleton lease ({@link ../../skills-src/conveyor/runner-lock.mjs}) records `owner`/`pid`/
 * `heartbeatAt` — no `cwd`. So resolving the runner's checkout takes two steps: find the live lock entry,
 * then derive its process's cwd (`lsof -p <pid> -d cwd`, the same probe the #3478 incident used by hand).
 *
 * PURE/IMPURE SPLIT (mirrors file-locks.mjs / queue-store.mjs): {@link classifyRunnerEntries} is pure — given
 * a list of already-read lock entries and a clock, it decides live vs. stale vs. ambiguous with no fs/process
 * access, so it is unit-tested against in-memory fixtures. {@link listRunnerLockEntries} and
 * {@link resolvePidCwd} are the thin impure fs/process shells; {@link resolveLiveRunnerCheckout} composes them
 * (both injectable, so the composition is also testable without a real runner or `lsof`).
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { parseLockEntry, isLeaseExpired } from '../readiness/file-locks.mjs';
import { RUNNER_LOCK_ROOT, RUNNER_LEASE_MINUTES } from '../../skills-src/conveyor/runner-lock.mjs';

// ── PURE CORE (no fs / clock / process — every input is injected) ─────────────────────────────────────────

/**
 * Given already-read lock entries under the runner lock root, decide which one (if any) is the SINGLE live
 * runner. Never guesses: zero live entries or MORE THAN ONE live entry both refuse rather than picking one —
 * the #3478 "silent success against the wrong checkout" failure mode this item fixes. A stale entry sitting
 * alongside exactly one live entry is NOT ambiguous — the live one is unambiguous regardless of how much stale
 * cruft sits next to it.
 * @param {Array<{id:string, owner:string, pid:number|null, heartbeatAt:string}>} entries
 * @param {number} nowMs
 * @param {number} [leaseMinutes]
 * @returns {{ok:true, entry:object}|{ok:false, reason:'no-live-runner'|'ambiguous', entries:Array<object>}}
 */
export function classifyRunnerEntries(entries, nowMs, leaseMinutes = RUNNER_LEASE_MINUTES) {
  const live = (Array.isArray(entries) ? entries : []).filter((e) => e && !isLeaseExpired(e, nowMs, leaseMinutes));
  if (live.length === 0) return { ok: false, reason: 'no-live-runner', entries: [] };
  if (live.length > 1) return { ok: false, reason: 'ambiguous', entries: live };
  return { ok: true, entry: live[0] };
}

// ── IMPURE SHELLS (the only fs/process boundary — thin, injectable) ────────────────────────────────────────

/**
 * Read every lock entry currently sitting under `lockRoot`, whatever key each was written under — NOT just
 * the runner's own fixed sentinel key. A `readLockEntry(lockRoot, path)` call (file-locks.mjs) only ever reads
 * back the ONE dir its own hashed key points to; scanning every subdirectory instead means a second/stray lock
 * dir (hand-tampered, a future multi-key scheme, leftover cruft) is actually SEEN rather than silently
 * invisible to a caller who only ever asks for the one key it expects. Tolerant: a missing root, an unreadable
 * dir, or a corrupt `lock.json` are skipped, never thrown (mirrors `readLockEntry`'s own corrupt-⇒-null floor).
 * @param {string} [lockRoot]
 * @returns {Array<{id:string, owner:string, pid:number|null, heartbeatAt:string}>}
 */
export function listRunnerLockEntries(lockRoot = RUNNER_LOCK_ROOT) {
  let ids;
  try { ids = readdirSync(lockRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); }
  catch { return []; }
  const out = [];
  for (const id of ids) {
    const file = join(lockRoot, id, 'lock.json');
    if (!existsSync(file)) continue;
    let entry;
    try { entry = parseLockEntry(readFileSync(file, 'utf8')); } catch { continue; }
    if (entry) out.push({ id, ...entry });
  }
  return out;
}

/**
 * Derive a same-machine process's current working directory via `lsof -a -p <pid> -d cwd -Fn` (the `-F` field
 * output is parsed, not the human table `lsof -p <pid> | grep cwd` the #3478 incident typed by hand — same
 * probe, machine-readable). Returns `null` on any failure (no such pid, `lsof` unavailable, unparseable output)
 * so the caller refuses rather than guessing.
 * @param {number} pid
 * @returns {string|null}
 */
export function resolvePidCwd(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  let out;
  try {
    out = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch { return null; }
  const line = out.split('\n').find((l) => l.startsWith('n'));
  return line ? line.slice(1).trim() || null : null;
}

/**
 * The composed resolution: find the SINGLE live runner lock, then its process's cwd. Every dependency is
 * injectable (defaults to the real fs/`lsof` shells) so this composition is unit-tested without a real runner.
 * @returns {{ok:true, checkoutRoot:string, pid:number, owner:string, heartbeatAt:string}
 *          |{ok:false, reason:'no-live-runner'|'ambiguous'|'pid-unknown'|'cwd-unresolvable', entries?:Array<object>, entry?:object}}
 */
export function resolveLiveRunnerCheckout({
  lockRoot = RUNNER_LOCK_ROOT,
  nowMs = Date.now(),
  leaseMinutes = RUNNER_LEASE_MINUTES,
  listEntries = listRunnerLockEntries,
  resolveCwd = resolvePidCwd,
} = {}) {
  const entries = listEntries(lockRoot);
  const verdict = classifyRunnerEntries(entries, nowMs, leaseMinutes);
  if (!verdict.ok) return verdict;
  const { entry } = verdict;
  if (!Number.isInteger(entry.pid)) return { ok: false, reason: 'pid-unknown', entry };
  const checkoutRoot = resolveCwd(entry.pid);
  if (!checkoutRoot) return { ok: false, reason: 'cwd-unresolvable', entry };
  return { ok: true, checkoutRoot, pid: entry.pid, owner: entry.owner, heartbeatAt: entry.heartbeatAt };
}
