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

// #2413 — the sanctioned `--purpose` token a parallel-/workflow lane acquire passes. `acquire` normalizes it
// into the dedicated `workflowLane: true` lease field (a contract field, NOT free-text `purpose`), so every
// downstream reader keys on the field. A MARKED lease switches the destructive-op guard fail-CLOSED: the op
// must assert this lease's own minted slug inline (`LANE_SESSION=<slug>`), because in the parallel-lane
// topology sibling sessions share `ownerSession` and cannot otherwise be told apart. See `laneMarkedSlug` /
// `assertedLaneSlug` and `we:scripts/guard-bash.mjs`.
export const WORKFLOW_LANE_PURPOSE = 'workflow-lane';

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
 *  the SOLE ownership signal `isForeignLease` compares against: it is stable across a session's separate
 *  Bash-tool calls yet distinct between concurrent sessions, and does NOT false-match two independent sessions
 *  that merely share an upper process ancestor (terminal, a parallel-lane orchestrator) — the over-match that
 *  made the earlier pid-ancestry heuristic unsafe in this guard's target topology (r2: pid-ancestry removed).
 *  `pid` is informational only (human-readable `status`/debug; a leaf that exits right after `acquire`, never
 *  useful for ownership).
 *  `predictedScope` (#2560 final slice) is the OPTIONAL, ADVISORY repo-qualified `"<repo>:<path>"` file-scope
 *  list a lane declares at acquire (`acquire --scope=`). It is the real predicted-scope source the live
 *  scope-lease observer/collector consumes — but it NEVER gates the acquire (the whole-clone lease is the real
 *  lock; §3i-A4 Fork 1). OMITTED from the marker when empty/absent, so a scope-less acquire produces a
 *  byte-identical marker to today (back-compat). Normalization is the CALLER's job — this stays zero-import. */
export function leaseBody({ session, purpose, acquiredAt, ttlMinutes = DEFAULT_LEASE_TTL_MINUTES, host, pid, ownerSession, workflowLane, predictedScope }) {
  return {
    session, purpose: purpose || null, acquiredAt, ttlMinutes, host: host || null,
    pid: pid ?? null, ownerSession: ownerSession ?? null,
    // #2413 — a MARKED (parallel-/workflow) lease. A plain boolean contract field (never null) so a reader can
    // key on it directly; older on-disk leases lack it (⇒ undefined ⇒ falsy ⇒ unmarked, today's semantics).
    workflowLane: !!workflowLane,
    // #2560 — advisory predicted file-scope, included ONLY when a non-empty array (omit-when-empty keeps a
    // scope-less acquire's marker byte-identical to today). A defensive copy so the caller can't alias in.
    ...(Array.isArray(predictedScope) && predictedScope.length ? { predictedScope: [...predictedScope] } : {}),
  };
}

/**
 * Is `lease` held by a session OTHER than mine? The #2367 ownership decision — pure & unit-tested; the impure
 * fs/env collection lives in the CLI (guard-bash.mjs). Decided from the durable session ids ALONE (r2 removed
 * the pid-ancestry fallback, whose chain-overlap OVER-MATCHED two independent sessions sharing an upper process
 * ancestor — the guard's own target topology, parallel lanes under one orchestrator — and so failed OPEN in the
 * one place it mattered while looking protective).
 *
 *   OWNED / FOREIGN: when the lease carries an `ownerSession` AND the caller read a `mySessionId`, the lease is
 *     FOREIGN iff `lease.ownerSession !== mySessionId` (equal ⇒ mine). Authoritative — the owner's own lease can
 *     never read as foreign because both sides key on the same `CLAUDE_CODE_SESSION_ID` string.
 *   DEGRADED (fail-OPEN, ALLOW ⇒ returns false): the lease has no `ownerSession` (an older lease, or one whose
 *     acquire couldn't read the env), OR the caller has no `mySessionId`. Without an identity signal on both
 *     sides "owner" and "foreign" are fundamentally indistinguishable, so this deliberately treats the lease as
 *     NOT foreign — matching the guard's established fail-open posture (a guard bug must never wedge the agent).
 *     This is the intentional trade-off of r2: drop the misleading "protective-looking but unsafe" pid-ancestry
 *     fallback rather than replace it with a noisy fail-closed.
 *   No lease ⇒ never foreign.
 */
export function isForeignLease({ lease, mySessionId } = {}) {
  if (!lease) return false;
  if (lease.ownerSession && mySessionId) return lease.ownerSession !== mySessionId;
  return false; // degraded: no identity signal on both sides ⇒ fail-open (allow) — see doc above
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

// #2413 — the minted-slug ownership channel for a MARKED (workflowLane) lease. In the parallel-/workflow
// topology every sibling lane shares `ownerSession`, so ambient identity can't tell a lane's own destructive
// op from a sibling's. Instead the guard keys on a MINTED slug (`<batchSlug>-<laneKey>`, stored in the lease's
// `session`) that each op must ASSERT inline in its command string — the one per-op channel with both ends
// in-repo (the orchestrator template mints + asserts it; the guard checks it here).

/** The slug a LIVE MARKED lease requires an op to assert, or null if the lease is unmarked / slug-less. The
 *  caller decides liveness (needs a clock); this is the pure marked-vs-unmarked + which-slug decision. */
export function laneMarkedSlug(lease) {
  return lease && lease.workflowLane && lease.session ? lease.session : null;
}

/** Parse an inline `LANE_SESSION=<slug>` assertion out of a command string (the per-op ownership channel a
 *  marked lease requires), or null if absent. Mirrors the guard's `LANE_CLOBBER_OK=1` env-token parse; the
 *  slug is a bare `<batchSlug>-<laneKey>` token, so match slug-shaped chars only (never a trailing operator). */
export function assertedLaneSlug(command) {
  const m = String(command || '').match(/\bLANE_SESSION=([A-Za-z0-9._/-]+)/);
  return m ? m[1] : null;
}
