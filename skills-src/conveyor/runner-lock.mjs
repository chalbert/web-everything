/**
 * @file skills-src/conveyor/runner-lock.mjs
 * @description The conveyor headless RUNNER's SINGLETON LOCK (WE #2702, epic #2677(b)) — the sole-writer
 *   discipline for the per-lane runner, mirrored from the drain daemon's whole-process lease
 *   ({@link ../../scripts/readiness/drain-lock.mjs}) and built on the SAME atomic `O_EXCL`/mkdir + TTL-lease
 *   primitive ({@link ../../scripts/readiness/file-locks.mjs}) — never a fork of it.
 *
 * WHY (#2701 build condition 2): the runner drives the mechanized tick core
 *   ({@link ../../scripts/conveyor/tick-core.mjs}) — it steps the state machine, filters launches through the
 *   guards, and surfaces the dispatch/watch decisions. If TWO runners ran at once they would both read the
 *   same free lanes + the same top-of-queue nums and both dispatch them — the exact double-dispatch the
 *   in-flight guard exists to prevent WITHIN a run, now at the cross-process boundary the guard cannot see
 *   (each runner keeps its own session-ephemeral bookkeeping). The ratified #2701 mechanics-not-agent boundary
 *   names a SINGLETON runner (no per-lane conductor, Option B rejected); this lock enforces it: at most one
 *   runner drives the conveyor at a time — the same sole-writer invariant the resident drain daemon holds over
 *   `main`, applied to the conveyor's dispatch.
 *
 * ONE lock, a whole-run lifetime: a runner ACQUIRES the lease at startup, HEARTBEATS it every tick, and
 *   RELEASES it at exit ({@link acquireRunnerLease}/{@link heartbeatRunnerLease}/{@link releaseRunnerLeaseIfOwned}).
 *   A second runner launch that finds a LIVE lease NO-OPS (its work is already being done); a STALE lease (a
 *   crashed runner) is reclaimed via the TTL. This is the drain's whole-process lease, minus the numbering
 *   critical-section mutex (the runner writes no NNN — it never lands; the drain daemon stays the sole writer
 *   to `main`) and minus the repo-scope payload (the runner is machine-global, not per-repo).
 *
 * SHARED, MACHINE-GLOBAL LOCK ROOT: a runner may be launched from ANY checkout (the primary, a lane clone),
 *   so the lock home is a fixed HOME-level dir ({@link RUNNER_LOCK_ROOT}), NOT a per-checkout `.claude/locks`
 *   — otherwise two checkouts would never see each other's runner lease. Like all lock state it is LOCAL-ONLY,
 *   machine-disposable (memory rule 105); it never lands on `main`.
 *
 * The atomic fs + reclaim decision live in file-locks.mjs (unit-tested there); this module is the thin,
 * runner-specific wiring over it (one fixed sentinel key + acquire/heartbeat/release/status), unit-tested in
 * skills-src/conveyor/__tests__/runner.test.mjs.
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, hostname } from 'node:os';
import {
  reserve, readLockEntry, releaseLockDir, heartbeat, isLeaseExpired, DEFAULT_LEASE_MINUTES,
} from '../../scripts/readiness/file-locks.mjs';

/** Machine-global lock home — shared across every checkout on the host so a runner launched from a lane clone
 *  and one launched from the primary contend on the SAME lease. Local-only, never committed/pushed (rule 105). */
export const RUNNER_LOCK_ROOT = join(homedir(), '.claude', 'conveyor-runner-locks');

/** The fixed sentinel "path" file-locks keys the runner's single lock dir by (a path hashes to one lock dir). */
export const RUNNER_LEASE_PATH = '<conveyor:runner-singleton-lease>';

/** A runner heartbeats within this lease for its whole lifetime; a heartbeat older than it ⇒ the runner
 *  crashed and the lease is reclaimable. Reuses the file-locks default (15 min) — it comfortably outlasts the
 *  runner's ~120 s tick, so a live runner never lets its own lease lapse between heartbeats. */
export const RUNNER_LEASE_MINUTES = DEFAULT_LEASE_MINUTES;

// ── owner identity ────────────────────────────────────────────────────────────────
/** A stable per-process owner id: host + pid + kind. The SAME string must be used to acquire, heartbeat, and
 *  release, so a caller builds it ONCE and threads it through (the file-locks fencing invariant). */
export function makeOwner(kind) { return `${hostname()}:${process.pid}:${kind}`; }
/** The singleton runner-lease owner for this process. */
export function runnerOwner() { return makeOwner('conveyor-runner'); }

// ── impure helper ─────────────────────────────────────────────────────────────────
function ensureRoot(lockRoot) { try { mkdirSync(lockRoot, { recursive: true }); } catch { /* best-effort; reserve() also self-heals a missing root */ } }
const nowIsoFrom = (nowMs) => new Date(nowMs).toISOString();

/**
 * Acquire the singleton runner lease for `owner`. `ok:true` ⇒ THIS process may run the conveyor loop (it won
 * the lease, or reclaimed a STALE one via the TTL). `ok:false, reason:'held'` ⇒ a LIVE runner already holds it
 * — the caller must NO-OP and exit (a second runner launch never double-drives). Thin over file-locks
 * `reserve` (atomic win, or reclaim-a-dead-holder via the TTL). Injectable clock keeps it unit-testable.
 * @returns {{ ok: boolean, reason: string, heldBy: string|null }}
 */
export function acquireRunnerLease(lockRoot = RUNNER_LOCK_ROOT, owner = runnerOwner(), { pid = process.pid, leaseMinutes = RUNNER_LEASE_MINUTES, nowMs = Date.now() } = {}) {
  ensureRoot(lockRoot);
  return reserve(lockRoot, RUNNER_LEASE_PATH, owner, nowMs, nowIsoFrom(nowMs), pid, 'unknown', leaseMinutes);
}

/** Refresh the runner lease heartbeat (a live runner extends its lease each tick). No-op returning `false` if
 *  the lease was reclaimed away from `owner` (a stale runner whose lease another process seized) — the caller
 *  should then STOP, since it no longer holds the singleton right to drive. */
export function heartbeatRunnerLease(lockRoot = RUNNER_LOCK_ROOT, owner = runnerOwner(), { pid = process.pid, nowMs = Date.now() } = {}) {
  const cur = readLockEntry(lockRoot, RUNNER_LEASE_PATH);
  if (!cur || cur.owner !== owner) return false;
  return heartbeat(lockRoot, RUNNER_LEASE_PATH, owner, nowIsoFrom(nowMs), pid);
}

/** Release the runner lease, but ONLY if `owner` still holds it (never stomp a reclaimer who seized it after a
 *  stale window — the file-locks fencing invariant). Idempotent (gone ⇒ no-op). */
export function releaseRunnerLeaseIfOwned(lockRoot = RUNNER_LOCK_ROOT, owner = runnerOwner()) {
  const cur = readLockEntry(lockRoot, RUNNER_LEASE_PATH);
  if (cur && cur.owner === owner) { releaseLockDir(lockRoot, RUNNER_LEASE_PATH); return true; }
  return false;
}

/**
 * The read-only runner-lease view: is a runner driving right now?
 *   • `held:true`  — a LIVE runner holds the lease (heartbeat within the TTL); a launch should NO-OP.
 *   • `held:false, stale:true`  — a lease exists but its holder crashed (heartbeat past the TTL) → reclaimable.
 *   • `held:false, stale:false` — no lease at all → no runner running.
 * @returns {{ held: boolean, stale: boolean, owner: string|null, heartbeatAt: string|null }}
 */
export function runnerLeaseStatus(lockRoot = RUNNER_LOCK_ROOT, { nowMs = Date.now(), leaseMinutes = RUNNER_LEASE_MINUTES } = {}) {
  const entry = readLockEntry(lockRoot, RUNNER_LEASE_PATH);
  if (!entry) return { held: false, stale: false, owner: null, heartbeatAt: null };
  const stale = isLeaseExpired(entry, nowMs, leaseMinutes);
  return { held: !stale, stale, owner: entry.owner, heartbeatAt: entry.heartbeatAt };
}
