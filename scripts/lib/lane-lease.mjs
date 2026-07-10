/**
 * lane-lease.mjs — the pure lease-decision core for the #2275 use-agnostic leased-checkout allocator.
 *
 * A lane in the #1933 pool is a use-agnostic isolated checkout. Today two sessions that each read
 * `lane-pool.mjs status`, both see a lane `clean`, and both pick it — a silent collision (observed while
 * filing #2285's slices: a `/slice` reset a lane a concurrent session was mid-edit in). The fix is an
 * EXCLUSIVE LEASE: `acquire` atomically marks a free lane held, and both a concurrent `acquire` and the
 * pool's own `refresh`/`provision` `reset --hard` treat a held lane as off-limits until `release`.
 *
 * This module is the DECISION half — no filesystem, no git, no clock — so it is unit-testable:
 *   - `isLeaseStale(lease, nowMs, ttlMs)`  — has a lease outlived its heartbeat TTL (owner died/hung)?
 *   - `chooseFreeLane(laneInfos, nowMs, ttlMs)` — the lowest-index lane safe to acquire, or null.
 *   - `leaseBody(...)` / `describeLease(lease)` — build / render the marker.
 * `lane-pool.mjs` owns the IO half (atomic O_EXCL write, git reset, status) and calls these.
 *
 * The exclusive hold is enforced by an atomic `O_EXCL` create of the marker (see `lane-pool.mjs`
 * `cmdAcquire`): for a PRISTINE free lane (no marker) that create is race-free, which is the collision the
 * story targets. Reclaiming a STALE marker (owner gone) has a small unlink→create window — the documented
 * residual this shares with the stronger central-broker lock #1936/#1945; a fresh acquire never races.
 */

export const LEASE_FILENAME = '.lane-lease';

// A held lane is presumed abandoned after this long with no release — long enough to outlast a slow drain
// cascade / batch, short enough that a crashed session's lane returns to the pool the same day. `acquire`
// may reclaim a lease older than this; `--ttl-minutes` overrides per call.
export const DEFAULT_LEASE_TTL_MINUTES = 240;

/**
 * Has this lease outlived its TTL (so the owner is presumed gone and the lane is reclaimable)?
 * A malformed / dateless lease is treated as stale (fail-open to reclaim, never strand a lane forever).
 */
export function isLeaseStale(lease, nowMs, ttlMs = DEFAULT_LEASE_TTL_MINUTES * 60_000) {
  if (!lease || typeof lease !== 'object') return true;
  const at = Date.parse(lease.acquiredAt);
  if (Number.isNaN(at)) return true;
  const ttl = Number.isFinite(lease.ttlMinutes) ? lease.ttlMinutes * 60_000 : ttlMs;
  return nowMs - at >= ttl;
}

/**
 * Is a lane safe to acquire right now? Exists, holds no other session's uncommitted / unpushed work
 * (`dirtyOrAhead` — the #2267 data-loss guard), and carries no LIVE lease (none, or a stale one to reclaim).
 */
export function isLaneAcquirable(info, nowMs, ttlMs) {
  if (!info || !info.exists) return false;
  const doa = info.dirtyOrAhead;
  if (doa && (doa.dirty || doa.ahead > 0)) return false; // someone's work lives here — never recycle it
  return !info.lease || isLeaseStale(info.lease, nowMs, ttlMs);
}

/**
 * The lowest-index acquirable lane, or null if the pool is fully held/busy. Deterministic (index order) so
 * concurrent acquirers converge on the same candidate and the atomic O_EXCL create picks exactly one winner.
 */
export function chooseFreeLane(laneInfos, nowMs, ttlMs) {
  const eligible = laneInfos
    .filter((i) => isLaneAcquirable(i, nowMs, ttlMs))
    .sort((a, b) => a.lane - b.lane);
  return eligible.length ? eligible[0].lane : null;
}

/** Build a lease marker object. Caller stamps `acquiredAt` (ISO) so this stays clock-free / testable.
 *  `ownerSession` (#2367) is the DURABLE session identity (`CLAUDE_CODE_SESSION_ID`, captured at acquire) —
 *  the PRIMARY, authoritative ownership signal `isForeignLease` compares against: it is stable across a
 *  session's separate Bash-tool calls yet distinct between concurrent sessions, and — unlike pid-ancestry —
 *  does NOT false-match two independent sessions that merely share an upper process ancestor (terminal, a
 *  parallel-lane orchestrator). `pid` is informational only (human-readable `status`/debug; a leaf that
 *  exits right after `acquire`, never useful for ownership). `ancestry` (the `pid-ancestry.mjs#getAncestryPids`
 *  chain at acquire) is the LEGACY fallback signal, only consulted for older leases that predate `ownerSession`. */
export function leaseBody({ session, purpose, acquiredAt, ttlMinutes = DEFAULT_LEASE_TTL_MINUTES, host, pid, ancestry, ownerSession }) {
  return {
    session, purpose: purpose || null, acquiredAt, ttlMinutes, host: host || null,
    pid: pid ?? null, ancestry: ancestry ?? null, ownerSession: ownerSession ?? null,
  };
}

/**
 * Do `mine` and `lease`'s recorded ancestry share ANY pid? Pure overlap test — the #2367 LEGACY ownership
 * heuristic (used only when the durable `ownerSession` is unavailable, see `isForeignLease`). A single scalar
 * pid comparison does not survive separate shell invocations (each Bash-tool call gets a fresh wrapper pid, a
 * leaf that dies before any later call runs); a full ancestry-CHAIN overlap does, because both chains converge
 * on the one process common to both moments — the session's own long-lived anchor. NOTE: this heuristic
 * OVER-MATCHES when two genuinely independent sessions share an upper ancestor (terminal / orchestrator) — the
 * reason `ownerSession` supersedes it as the primary signal. `lease.pid` (informational-only, see `leaseBody`)
 * is folded in as a last-resort single-value fallback so an OLDER lease (acquired before `ancestry` existed)
 * still gets a best-effort check rather than silently no-oping forever.
 */
export function ancestryOverlaps(mine, lease) {
  if (!Array.isArray(mine) || mine.length === 0 || !lease) return false;
  const theirs = Array.isArray(lease.ancestry) && lease.ancestry.length ? lease.ancestry : (lease.pid ? [lease.pid] : []);
  if (theirs.length === 0) return false;
  const set = new Set(mine.map(Number));
  return theirs.some((p) => set.has(Number(p)));
}

/**
 * Is `lease` held by a session OTHER than mine? The #2367 ownership decision — pure & unit-tested; the impure
 * `ps`/fs/env collection lives in the CLI (guard-bash.mjs) / `pid-ancestry.mjs`.
 *
 *   PRIMARY (durable): when BOTH the lease and the caller carry a session id, the lease is FOREIGN iff
 *     `lease.ownerSession !== mySessionId`. This is authoritative and does NOT fail open on shared upper
 *     process ancestors — the failure mode that made the ancestry-only test unsafe in the guard's own target
 *     topology (parallel lanes under one orchestrator, where every session's ancestry overlaps every other's).
 *   FALLBACK (legacy): an OLDER lease with no `ownerSession`, or a caller that couldn't read a session id,
 *     falls back to the `ancestryOverlaps` heuristic (best-effort — see its over-match caveat).
 *   No lease ⇒ never foreign.
 */
export function isForeignLease({ lease, mySessionId, myAncestry } = {}) {
  if (!lease) return false;
  if (lease.ownerSession && mySessionId) return lease.ownerSession !== mySessionId;
  return !ancestryOverlaps(myAncestry, lease);
}

/** One-line human description of a lease for `status` output. */
export function describeLease(lease) {
  if (!lease) return '';
  const who = lease.session || 'unknown';
  const why = lease.purpose ? ` (${lease.purpose})` : '';
  return `leased by ${who}${why} @ ${lease.acquiredAt}`;
}

/** Does `session` own this lease? (Guards `release` from dropping another session's hold without --force.) */
export function leaseOwnedBy(lease, session) {
  return !!lease && !!session && lease.session === session;
}
