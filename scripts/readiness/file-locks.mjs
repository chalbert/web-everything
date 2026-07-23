/**
 * @file scripts/readiness/file-locks.mjs
 * @description Mandatory write-time file-reservation lock for the #1933 clone orchestrator — the
 *   #1935 Fork-2 / #1936 PESSIMISTIC tier on top of slice-3's optimistic git-merge floor (backlog #1945).
 *
 * The STRONGER, write-enforced sibling of the advisory soft-reservation hint
 * ({@link ./reservations.mjs}, #083). That hint only deprioritizes item SELECTION and self-corrects at
 * a re-read seam — its failure mode is wasted analysis, never corruption. THIS lock guards actual file
 * EDITS in the central checkout: before a lane edits a merge-risk file (the small residual set after
 * #1938 shrank the monolith lock-set), it must RESERVE that path, and a second lane needing a held path
 * waits or defers. The optimistic floor only DETECTS a clean-but-wrong structured merge after the fact
 * (post-hoc `multiLaneFiles`); this PREVENTS the wasted-lane and clean-but-wrong-merge cases up front.
 *
 * ── Ratified design (#1936) this module encodes ──────────────────────────────────────────────────
 *   • Fork 1 — primitive: an ATOMIC lock directory / `O_EXCL` lockfile PER reserved path under the
 *     LOCAL central checkout (here: `.claude/locks/<path-hash>/`), holding `{ owner, path, pid,
 *     heartbeatAt }` JSON. `mkdir` is atomic on POSIX and `O_EXCL` create is atomic on a local fs, so
 *     acquisition is race-free across SEPARATE invocations with no daemon — and per-path files avoid the
 *     single-file write-contention point a shared registry (rejected option c) would reintroduce. A
 *     mandatory write-time lock CANNOT share the advisory tier's self-correcting single-file shape.
 *   • Fork 2 — reclaim: a HEARTBEAT-TTL LEASE is the correctness floor (the Chubby / etcd / ZooKeeper
 *     convergence; mirrors {@link ./reservations.mjs}'s `ttlMinutes` precedent) — any session may reclaim
 *     a lock whose heartbeat is older than the lease. Layered ON TOP, a same-machine PID-liveness FAST
 *     PATH reclaims a provably-dead owner immediately rather than waiting out the full TTL. PID-liveness
 *     is layered, NEVER primary: the kernel reuses PIDs, so the caller must verify the owner is gone
 *     ({@link pidLiveness} reports `dead | alive | unknown`; only `dead` accelerates reclaim).
 *   • Insurance invariant: the central broker is the FENCING point — it rejects a push from a lane whose
 *     lease was reclaimed mid-flight ({@link wasReclaimed}) — rather than baking fencing tokens into the
 *     lock entry. Closes the Kleppmann lease-expiry race (owner pauses past TTL, gets reclaimed, wakes,
 *     writes anyway) while keeping the lock entry simple.
 *
 * ── Purity split (mirrors reservations.mjs) ─────────────────────────────────────────────────────
 * The DECISION logic here is PURE — no fs, no `Date` reads, no `process`. Callers inject `nowMs`, the
 * owner identity, and a probed PID-liveness verdict, so the same logic runs against a live lock dir or
 * an in-memory fixture in tests. The thin atomic-fs primitives ({@link acquireLockDir} /
 * {@link releaseLockDir} / {@link heartbeat} / {@link readLockEntry}) are the ONLY impure surface; they
 * own the `mkdir`/`O_EXCL` boundary and are deliberately tiny so the testable logic stays pure.
 */

import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

/** Default lease before a held lock is considered stale and reclaimable. Short enough that a crashed
 *  owner frees a path within a working block; long enough to outlast a normal reserve→edit→commit→push
 *  window between heartbeats. The OWNER refreshes its heartbeat well inside this. */
export const DEFAULT_LEASE_MINUTES = 15;

/** How often a live owner should refresh its heartbeat — a small fraction of the lease so a transient
 *  hiccup never trips the TTL. Advisory to callers; the lock logic only reads `heartbeatAt`. */
export const HEARTBEAT_INTERVAL_MINUTES = 3;

/** The lock root under the central checkout (#1936 Fork 1a — LOCAL home, never committed/pushed). */
export const LOCK_ROOT = '.claude/locks';

// ── Pure decision logic (no fs / clock / process) ──────────────────────────────

/** Stable, fs-safe per-path lock id: a path hashes to one lock dir. Avoids slashes-in-dirnames and
 *  keeps the lock home flat. Pure — same input → same id. */
export function lockIdFor(path) {
  return createHash('sha256').update(String(path)).digest('hex').slice(0, 16);
}

/**
 * Tolerant parse of a lock-entry's JSON text → `{ owner, path, pid, heartbeatAt }` or `null`. NEVER
 * throws: a half-written / corrupt entry parses to `null` so the caller treats the lock as absent
 * rather than wedging (a corrupt lock must not be un-reclaimable). `pid` is normalized to a number or
 * `null` (the PID fast-path is optional metadata, not load-bearing).
 * @param {string} text
 */
export function parseLockEntry(text) {
  if (!text || !text.trim()) return null;
  let raw;
  try { raw = JSON.parse(text); } catch { return null; }
  if (!raw || !raw.owner || !raw.heartbeatAt) return null;
  const pid = Number.isInteger(raw.pid) ? raw.pid : null;
  // `meta` (#2458) is opaque owner-supplied metadata (e.g. a drain lease's repo scope). Preserve it verbatim
  // when present and a plain object; a lock with no meta parses exactly as before (no `meta` key added).
  const meta = raw.meta && typeof raw.meta === 'object' && !Array.isArray(raw.meta) ? raw.meta : null;
  return { owner: String(raw.owner), path: raw.path != null ? String(raw.path) : null, pid, heartbeatAt: String(raw.heartbeatAt), ...(meta ? { meta } : {}) };
}

/** Age in ms of an ISO timestamp vs `nowMs`; Infinity when unparseable (⇒ treated as expired/stale). */
function ageMs(at, nowMs) {
  const t = Date.parse(at);
  return Number.isFinite(t) ? nowMs - t : Infinity;
}

/**
 * Is a held lock entry's lease EXPIRED at `nowMs`? Fork-2 correctness floor: a heartbeat older than the
 * lease (or an unparseable one) is stale and reclaimable. Pure.
 * @param {{heartbeatAt:string}} entry
 * @param {number} nowMs
 * @param {number} [leaseMinutes]
 */
export function isLeaseExpired(entry, nowMs, leaseMinutes = DEFAULT_LEASE_MINUTES) {
  if (!entry) return true;
  return ageMs(entry.heartbeatAt, nowMs) > leaseMinutes * 60_000;
}

/**
 * The reclaim decision for a held lock — the heart of Fork 2 (a)+(b). Given the current entry, the
 * clock, and a PID-liveness verdict the CALLER probed (`'dead' | 'alive' | 'unknown'`), decide whether a
 * NEW owner may seize the path, and WHY. Pure — the caller owns the probe + the fs seize.
 *
 *   • A path with no entry → free (acquirable).
 *   • Held by `requester` already → it's theirs (re-acquire = heartbeat refresh).
 *   • `pidLiveness === 'dead'` → PID FAST PATH: the same-machine owner is provably gone, reclaim
 *     immediately without waiting out the lease. `'dead'` must mean the caller verified the PID is gone
 *     (or, robustly, that a live PID's command line is NOT the owning session — the PID-reuse guard).
 *   • else lease expired → reclaim via the TTL floor (host-independent; the only safe path when liveness
 *     is `'alive'`/`'unknown'`, e.g. PID reused or owner on another host).
 *   • else → BLOCKED: a live owner holds it; the requester must wait or defer.
 *
 * @returns {{ acquirable: boolean, reason: 'free'|'own'|'pid-dead'|'lease-expired'|'held', heldBy: string|null }}
 */
export function reclaimDecision(entry, nowMs, requester, pidLiveness = 'unknown', leaseMinutes = DEFAULT_LEASE_MINUTES) {
  if (!entry) return { acquirable: true, reason: 'free', heldBy: null };
  if (entry.owner === requester) return { acquirable: true, reason: 'own', heldBy: entry.owner };
  if (pidLiveness === 'dead') return { acquirable: true, reason: 'pid-dead', heldBy: entry.owner };
  if (isLeaseExpired(entry, nowMs, leaseMinutes)) return { acquirable: true, reason: 'lease-expired', heldBy: entry.owner };
  return { acquirable: false, reason: 'held', heldBy: entry.owner };
}

/**
 * The broker FENCING check (#1936 insurance invariant). After a lane finishes, the central broker calls
 * this before accepting its push: the lock the lane THOUGHT it held was RECLAIMED mid-flight if the path
 * is now owned by someone else, OR is no longer held by the lane (reclaimed + re-acquired or freed). A
 * `true` here means the lane's lease lapsed under it — reject the push (the Kleppmann race). Pure.
 * @param {{owner:string}|null} currentEntry  the lock entry as it stands NOW (post-work), or null if gone
 * @param {string} laneOwner  the session the lane acquired the lock as
 * @returns {boolean} true ⇒ the lease was reclaimed; the broker must reject this lane's push for this path
 */
export function wasReclaimed(currentEntry, laneOwner) {
  if (!currentEntry) return true;            // freed / reclaimed away — lane no longer holds it
  return currentEntry.owner !== laneOwner;   // someone else owns it now — reclaimed mid-flight
}

/**
 * Build a fresh lock-entry payload. Pure (caller injects `nowIso` + `pid`). `pid` is optional metadata
 * for the same-machine fast path; omit it (null) when it can't be trusted. `meta` (#2458) is optional,
 * opaque owner-supplied metadata (e.g. a drain lease's repo scope); a null/empty meta adds no key, so
 * entries without it are byte-identical to before.
 */
export function makeLockEntry(owner, path, nowIso, pid = null, meta = null) {
  const hasMeta = meta && typeof meta === 'object' && !Array.isArray(meta) && Object.keys(meta).length > 0;
  return { owner: String(owner), path: String(path), pid: Number.isInteger(pid) ? pid : null, heartbeatAt: String(nowIso), ...(hasMeta ? { meta } : {}) };
}

/**
 * Plan reservations for a set of merge-risk paths a lane intends to edit: given the requester, the
 * clock, and a `probe(path) -> { entry, pidLiveness }` the caller supplies (reading each lock dir +
 * probing liveness), partition the wanted paths into `acquire` (free/reclaimable now) and `blocked`
 * (a live owner holds them → wait or defer). Pure orchestration over {@link reclaimDecision}; the caller
 * then atomically seizes each `acquire` path and waits/defers on `blocked`.
 * @param {string[]} paths
 * @param {string} requester
 * @param {number} nowMs
 * @param {(path:string)=>{entry:object|null, pidLiveness?:string}} probe
 * @param {number} [leaseMinutes]
 */
export function planReservations(paths, requester, nowMs, probe, leaseMinutes = DEFAULT_LEASE_MINUTES) {
  const acquire = [], blocked = [];
  for (const path of paths) {
    const { entry, pidLiveness = 'unknown' } = probe(path) || {};
    const d = reclaimDecision(entry, nowMs, requester, pidLiveness, leaseMinutes);
    (d.acquirable ? acquire : blocked).push({ path, ...d });
  }
  return { acquire, blocked, allAcquirable: blocked.length === 0 };
}

// ── Atomic fs primitives (the ONLY impure surface; thin by design) ─────────────
// These own the mkdir / O_EXCL boundary. Decision-making stays in the pure functions above so the
// logic is unit-tested without touching the fs. `lockRoot` is the absolute `.claude/locks` dir.

/** Absolute lock dir for a path under `lockRoot`. */
export function lockDirFor(lockRoot, path) {
  return join(lockRoot, lockIdFor(path));
}

/**
 * ATOMICALLY acquire the lock dir for `path` (Fork-1 primitive). `mkdir` (non-recursive) is atomic on
 * POSIX: it succeeds for exactly ONE racing caller and throws `EEXIST` for the rest — so the winner
 * writes the entry, the losers see the dir already exists. Returns `true` on a clean win, `false` if the
 * dir already existed (someone else holds it — the caller then reads the entry + applies
 * {@link reclaimDecision}). The entry file is written only AFTER the atomic mkdir wins, so the dir's
 * existence is the lock and the entry is its metadata.
 * @param {string} lockRoot
 * @param {string} path
 * @param {object} entry  from {@link makeLockEntry}
 */
export function acquireLockDir(lockRoot, path, entry) {
  const dir = lockDirFor(lockRoot, path);
  try {
    mkdirSync(dir, { recursive: false });           // ← the atomic gate: EEXIST for losers
  } catch (e) {
    if (e && e.code === 'EEXIST') return false;
    if (e && e.code === 'ENOENT') {                 // lockRoot itself missing — create it once, retry
      mkdirSync(lockRoot, { recursive: true });
      try { mkdirSync(dir, { recursive: false }); } catch (e2) { if (e2 && e2.code === 'EEXIST') return false; throw e2; }
    } else { throw e; }
  }
  writeFileSync(join(dir, 'lock.json'), JSON.stringify(entry, null, 2) + '\n', 'utf8');
  return true;
}

/** Read the lock entry for `path` (or `null` if the dir/entry is absent or corrupt). Impure read. */
export function readLockEntry(lockRoot, path) {
  const file = join(lockDirFor(lockRoot, path), 'lock.json');
  if (!existsSync(file)) return null;
  try { return parseLockEntry(readFileSync(file, 'utf8')); } catch { return null; }
}

/** Refresh `path`'s heartbeat (a live owner extends its lease). Overwrites the entry's `heartbeatAt`
 *  in place; no-op if the lock dir is gone (reclaimed away — the broker fencing check will catch it). */
export function heartbeat(lockRoot, path, owner, nowIso, pid = null, meta = null) {
  const dir = lockDirFor(lockRoot, path);
  if (!existsSync(dir)) return false;
  writeFileSync(join(dir, 'lock.json'), JSON.stringify(makeLockEntry(owner, path, nowIso, pid, meta), null, 2) + '\n', 'utf8');
  return true;
}

/** Release `path`'s lock by removing its dir. Caller should only release locks IT owns (verify via
 *  {@link readLockEntry} first if reclaiming another's). Idempotent (gone ⇒ no-op). */
export function releaseLockDir(lockRoot, path) {
  rmSync(lockDirFor(lockRoot, path), { recursive: true, force: true });
}

/**
 * Acquire-or-reclaim `path` for `owner` in ONE impure call, applying the pure decision: atomically try
 * to win the dir; if it already exists, read the entry + the caller-probed `pidLiveness`, and reclaim
 * (release + re-acquire) when {@link reclaimDecision} says so, else report it BLOCKED. Returns the
 * outcome the lane acts on. `pidLiveness` defaults to `'unknown'` (TTL-only reclaim) unless the caller
 * probed same-machine liveness.
 * @returns {{ ok: boolean, reason: string, heldBy: string|null }}
 */
export function reserve(lockRoot, path, owner, nowMs, nowIso, pid = null, pidLiveness = 'unknown', leaseMinutes = DEFAULT_LEASE_MINUTES, meta = null) {
  const entry = makeLockEntry(owner, path, nowIso, pid, meta);
  if (acquireLockDir(lockRoot, path, entry)) return { ok: true, reason: 'free', heldBy: owner };
  const current = readLockEntry(lockRoot, path);
  const d = reclaimDecision(current, nowMs, owner, pidLiveness, leaseMinutes);
  if (!d.acquirable) return { ok: false, reason: d.reason, heldBy: d.heldBy };
  if (d.reason === 'own') { heartbeat(lockRoot, path, owner, nowIso, pid, meta); return { ok: true, reason: 'own', heldBy: owner }; }
  // reclaim a stale/dead owner: drop its dir then re-win atomically (another reclaimer may race — EEXIST
  // ⇒ we lost the reclaim, report blocked so the caller re-probes rather than stomping the winner).
  releaseLockDir(lockRoot, path);
  if (acquireLockDir(lockRoot, path, entry)) return { ok: true, reason: d.reason, heldBy: owner };
  return { ok: false, reason: 'held', heldBy: (readLockEntry(lockRoot, path) || {}).owner || null };
}
