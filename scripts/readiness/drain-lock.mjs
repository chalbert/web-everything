/**
 * @file scripts/readiness/drain-lock.mjs
 * @description The drain's DUAL-LOCK concurrency guard (#2391, under #2387) — two distinct locks the land
 *   paths and the drain lifecycle contend on, both built on the atomic `O_EXCL`/mkdir + TTL-lease primitive
 *   in {@link ./file-locks.mjs} (never a fork of it).
 *
 * WHY (#2391): the drain is the SOLE SERIAL WRITER to main (#2288/#2290) — at most one process may mint an
 * NNN. Today nothing ENFORCES that: three land call sites number-then-push with no mutual exclusion
 * (`we:scripts/lane-drain.mjs` finalizeLand, `we:scripts/merge-ai-prs.mjs` land, `we:scripts/pr-land.mjs`
 * fallback-git), so two lands racing off the same base could both compute `max+1` and assign the SAME NNN —
 * a latent duplicate-numbering race the #2318 tripwire only catches AFTER it lands. This module closes it.
 *
 * TWO LOCKS, distinct lifetimes:
 *   1. NUMBERING-CRITICAL-SECTION MUTEX — a short-lived, TTL-bounded lock wrapping ONLY the number+publish
 *      step at each land call site ({@link withNumberingLock}). Held for the seconds the numbering+push
 *      takes; a crashed holder expires by the (short) TTL so the section never wedges. Enforces the
 *      sole-serial-writer invariant: at most one process assigns an NNN at a time.
 *   2. WHOLE-PROCESS DRAIN LEASE — a distinct lock held for a drain run's FULL lifetime
 *      ({@link acquireDrainLease}/{@link heartbeatDrainLease}/{@link releaseDrainLease}). A second drain
 *      launch that finds a LIVE lease no-ops (its work is already being done); a STALE lease (a crashed
 *      drain) is reclaimed via the TTL. push-at-close reads {@link drainLeaseStatus} to know a drain is
 *      mid-flight before it publishes.
 *
 * SHARED, MACHINE-GLOBAL LOCK ROOT: the contenders run in DIFFERENT checkouts (a lane clone, the user's
 * primary, a `/pr` fast-drain), so the lock home is a fixed HOME-level dir ({@link DRAIN_LOCK_ROOT}), NOT the
 * per-checkout `.claude/locks` file-locks uses — otherwise two checkouts would never see each other's lock.
 * Like all lock state it is LOCAL-ONLY, machine-disposable (Rule #105); it never lands on main.
 *
 * The atomic fs + reclaim decision live in file-locks.mjs (unit-tested there); this module is the thin,
 * drain-specific wiring over it (two fixed sentinel keys + a spin-acquire wrapper), unit-tested in
 * scripts/readiness/__tests__/drain-lock.test.mjs.
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, hostname } from 'node:os';
import {
  reserve, readLockEntry, releaseLockDir, heartbeat, isLeaseExpired, DEFAULT_LEASE_MINUTES,
} from './file-locks.mjs';

/** Machine-global lock home — shared across every checkout on the host so lands in DIFFERENT clones contend
 *  on the SAME lock. Local-only, never committed/pushed (Rule #105). */
export const DRAIN_LOCK_ROOT = join(homedir(), '.claude', 'drain-locks');

/** The two fixed sentinel "paths" file-locks keys its lock dirs by (a path hashes to one lock dir). They are
 *  distinct strings ⇒ distinct lock dirs ⇒ the mutex and the lease never alias. */
export const NUMBERING_LOCK_PATH = '<drain:numbering-critical-section>';
export const DRAIN_LEASE_PATH = '<drain:whole-process-lease>';

/** The numbering section is SECONDS (number a few files + one push), so its TTL is short — a crashed holder
 *  frees the section fast. Long enough to outlast a slow push. */
export const NUMBERING_LEASE_MINUTES = 5;

/** A drain run heartbeats within this lease for its whole lifetime; a heartbeat older than it ⇒ the drain
 *  crashed and the lease is reclaimable. Reuses the file-locks default (15 min). */
export const DRAIN_LEASE_MINUTES = DEFAULT_LEASE_MINUTES;

// ── owner identity ──────────────────────────────────────────────────────────────
/** A stable per-process owner id: host + pid + kind. The SAME string must be used to acquire, heartbeat, and
 *  release, so a caller builds it ONCE and threads it through. */
export function makeOwner(kind) { return `${hostname()}:${process.pid}:${kind}`; }
/** The whole-process drain lease owner for this process. */
export function drainOwner() { return makeOwner('drain'); }

// ── impure helpers ────────────────────────────────────────────────────────────────
function ensureRoot(lockRoot) { try { mkdirSync(lockRoot, { recursive: true }); } catch { /* best-effort; reserve() also self-heals a missing root */ } }
const nowIsoFrom = (nowMs) => new Date(nowMs).toISOString();

/** Block the calling thread `ms` milliseconds WITHOUT a busy-wait (mirrors lane-drain's sleepSync). Used to
 *  space the spin-acquire polls. A SharedArrayBuffer-less env degrades to no wait (the spin still bounds via
 *  its deadline). */
export function sleepSyncMs(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(0, Math.floor(ms))); } catch { /* no SAB — skip */ }
}

// ── (1) numbering-critical-section mutex ─────────────────────────────────────────

/**
 * Try to acquire the numbering mutex ONCE for `owner`. Thin over file-locks `reserve` (which atomically wins
 * the dir, or reclaims a stale/dead holder via the TTL). Returns `{ ok, reason, heldBy }`.
 */
export function tryAcquireNumberingLock(lockRoot, owner, { pid = process.pid, leaseMinutes = NUMBERING_LEASE_MINUTES, nowMs = Date.now() } = {}) {
  ensureRoot(lockRoot);
  return reserve(lockRoot, NUMBERING_LOCK_PATH, owner, nowMs, nowIsoFrom(nowMs), pid, 'unknown', leaseMinutes);
}

/** Release the numbering mutex, but ONLY if `owner` still holds it (never stomp a reclaimer who seized it
 *  mid-section — the file-locks fencing invariant). Idempotent. */
export function releaseNumberingLockIfOwned(lockRoot, owner) {
  const cur = readLockEntry(lockRoot, NUMBERING_LOCK_PATH);
  if (cur && cur.owner === owner) { releaseLockDir(lockRoot, NUMBERING_LOCK_PATH); return true; }
  return false;
}

/**
 * Run `fn` inside the NUMBERING CRITICAL SECTION — the mutex that makes the number+publish step
 * sole-serial-writer (#2288/#2290). Spin-acquires (reclaim-aware) up to `waitMs`, runs `fn`, then releases
 * (only if still owned). The default `waitMs` is a full lease, so a CRASHED holder is always reclaimed within
 * the budget and only a genuinely-live, actively-numbering holder can block — and that finishes in seconds.
 *
 * FALLBACK (never hang a land): if a live holder blocks PAST the budget (pathological — numbering is
 * seconds), `fn` runs WITHOUT the lock and the result carries `contended: true` so the caller can warn. This
 * degrades to today's (lock-free) behaviour rather than wedging the land; the #2318 duplicate-NNN tripwire +
 * `number-stranded` remain the backstop. Injectable clock/sleep keep it unit-testable.
 *
 * @returns {{ result: any, held: boolean, contended: boolean, heldBy: string|null, reason: string }}
 */
export function withNumberingLock(fn, {
  lockRoot = DRAIN_LOCK_ROOT,
  owner = makeOwner('numbering'),
  pid = process.pid,
  leaseMinutes = NUMBERING_LEASE_MINUTES,
  waitMs = NUMBERING_LEASE_MINUTES * 60_000,
  pollMs = 250,
  now = Date.now,
  sleep = sleepSyncMs,
} = {}) {
  ensureRoot(lockRoot);
  const deadline = now() + waitMs;
  let acq = tryAcquireNumberingLock(lockRoot, owner, { pid, leaseMinutes, nowMs: now() });
  while (!acq.ok && now() < deadline) {
    sleep(pollMs);
    acq = tryAcquireNumberingLock(lockRoot, owner, { pid, leaseMinutes, nowMs: now() });
  }
  const held = acq.ok;
  try {
    return { result: fn(), held, contended: !held, heldBy: acq.heldBy ?? null, reason: acq.reason };
  } finally {
    if (held) releaseNumberingLockIfOwned(lockRoot, owner);
  }
}

// ── (2) whole-process drain lease ────────────────────────────────────────────────

/**
 * Acquire the whole-process drain lease for `owner`. `ok:true` ⇒ this process may run the drain (it won the
 * lease, or reclaimed a STALE one via the TTL). `ok:false, reason:'held'` ⇒ a LIVE drain already holds it —
 * the caller must NO-OP (a second drain launch). Thin over file-locks `reserve`.
 */
export function acquireDrainLease(lockRoot = DRAIN_LOCK_ROOT, owner = drainOwner(), { pid = process.pid, leaseMinutes = DRAIN_LEASE_MINUTES, nowMs = Date.now(), scope = null } = {}) {
  ensureRoot(lockRoot);
  // #2458 — record THIS drain's repo scope in the lease so a differently-scoped launch can tell whether the
  // holder's next pass actually covers its repos, instead of blindly no-op'ing with a false coverage claim.
  // On a re-acquire of an OWN live lease (reserve's 'own' path is a heartbeat) a null `scope` carries the
  // existing recorded scope forward — mirrors heartbeatDrainLease so a re-acquire never silently drops it.
  const cur = readLockEntry(lockRoot, DRAIN_LEASE_PATH);
  const keep = normalizeScope(scope) || (cur && cur.owner === owner && cur.meta && normalizeScope(cur.meta.scope)) || null;
  return reserve(lockRoot, DRAIN_LEASE_PATH, owner, nowMs, nowIsoFrom(nowMs), pid, 'unknown', leaseMinutes, keep ? { scope: keep } : null);
}

/** Refresh the drain lease heartbeat (a live drain extends its lease each pass). No-op if the lease was
 *  reclaimed away from `owner` (returns false — the caller's next acquire attempt will surface it). The
 *  recorded repo `scope` (#2458) is PRESERVED across heartbeats: a caller-supplied scope refreshes it, else
 *  the existing lease's scope is carried forward (heartbeat rebuilds the entry, so it must be re-supplied). */
export function heartbeatDrainLease(lockRoot = DRAIN_LOCK_ROOT, owner = drainOwner(), { pid = process.pid, nowMs = Date.now(), scope = null } = {}) {
  const cur = readLockEntry(lockRoot, DRAIN_LEASE_PATH);
  if (!cur || cur.owner !== owner) return false;
  const keep = normalizeScope(scope) || (cur.meta && normalizeScope(cur.meta.scope)) || null;
  return heartbeat(lockRoot, DRAIN_LEASE_PATH, owner, nowIsoFrom(nowMs), pid, keep ? { scope: keep } : null);
}

/** Release the drain lease, but ONLY if `owner` still holds it (never stomp a reclaimer). Idempotent. */
export function releaseDrainLease(lockRoot = DRAIN_LOCK_ROOT, owner = drainOwner()) {
  const cur = readLockEntry(lockRoot, DRAIN_LEASE_PATH);
  if (cur && cur.owner === owner) { releaseLockDir(lockRoot, DRAIN_LEASE_PATH); return true; }
  return false;
}

/**
 * The read-only drain-lease view push-at-close consults: is a drain mid-flight right now?
 *   • `held:true`  — a LIVE drain holds the lease (heartbeat within the TTL); push-at-close should wait/skip.
 *   • `held:false, stale:true`  — a lease exists but its holder crashed (heartbeat past the TTL) → reclaimable.
 *   • `held:false, stale:false` — no lease at all → no drain running.
 * @returns {{ held: boolean, stale: boolean, owner: string|null, heartbeatAt: string|null }}
 */
export function drainLeaseStatus(lockRoot = DRAIN_LOCK_ROOT, { nowMs = Date.now(), leaseMinutes = DRAIN_LEASE_MINUTES } = {}) {
  const entry = readLockEntry(lockRoot, DRAIN_LEASE_PATH);
  if (!entry) return { held: false, stale: false, owner: null, heartbeatAt: null, scope: null };
  const stale = isLeaseExpired(entry, nowMs, leaseMinutes);
  // #2458 — surface the holder's recorded repo scope (or null when a legacy/unscoped lease didn't record it).
  return { held: !stale, stale, owner: entry.owner, heartbeatAt: entry.heartbeatAt, scope: (entry.meta && normalizeScope(entry.meta.scope)) || null };
}

/** #2458 — normalize a repo-scope input to a de-duped, sorted array of non-empty slug strings, or `null`
 *  when there is nothing usable. Keeps the lease payload canonical and scope comparisons order-independent. */
export function normalizeScope(scope) {
  if (!Array.isArray(scope)) return null;
  const slugs = [...new Set(scope.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()))].sort();
  return slugs.length ? slugs : null;
}
