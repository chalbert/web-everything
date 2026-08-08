/**
 * @file lane-lease.test.mjs — proof of the #2275 lease-decision core: staleness (TTL reclaim),
 *   acquirability (dirty/ahead + live-lease exclusion), and free-lane choice (lowest-index, deterministic).
 *   All pure — `lane-pool.mjs` supplies the IO (atomic O_EXCL create, git reset, status).
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LEASE_TTL_MINUTES,
  WORKFLOW_LANE_PURPOSE,
  isLeaseStale,
  isLaneAcquirable,
  chooseFreeLane,
  leaseBody,
  describeLease,
  leaseOwnedBy,
  leaseOwnedByCaller,
  isForeignLease,
  laneMarkedSlug,
  assertedLaneSlug,
} from '../lane-lease.mjs';

const T0 = Date.parse('2026-07-05T12:00:00.000Z');
const ttlMs = DEFAULT_LEASE_TTL_MINUTES * 60_000;
const leaseAt = (isoOffsetMin, extra = {}) => ({ session: 'sess-a', acquiredAt: new Date(T0 + isoOffsetMin * 60_000).toISOString(), ...extra });

describe('isLeaseStale', () => {
  it('a fresh lease (just acquired) is live', () => {
    expect(isLeaseStale(leaseAt(0), T0, ttlMs)).toBe(false);
  });
  it('a lease younger than its TTL is live', () => {
    expect(isLeaseStale(leaseAt(-(DEFAULT_LEASE_TTL_MINUTES - 1)), T0, ttlMs)).toBe(false);
  });
  it('a lease older than its TTL is stale (reclaimable)', () => {
    expect(isLeaseStale(leaseAt(-(DEFAULT_LEASE_TTL_MINUTES + 1)), T0, ttlMs)).toBe(true);
  });
  it('honors a per-lease ttlMinutes over the default', () => {
    const short = leaseAt(-10, { ttlMinutes: 5 }); // 10 min old, 5 min TTL → stale
    expect(isLeaseStale(short, T0, ttlMs)).toBe(true);
    const long = leaseAt(-10, { ttlMinutes: 60 }); // 10 min old, 60 min TTL → live
    expect(isLeaseStale(long, T0, ttlMs)).toBe(false);
  });
  it('treats a malformed / dateless / null lease as stale (fail-open, never strand a lane)', () => {
    expect(isLeaseStale(null, T0, ttlMs)).toBe(true);
    expect(isLeaseStale({}, T0, ttlMs)).toBe(true);
    expect(isLeaseStale({ acquiredAt: 'not-a-date' }, T0, ttlMs)).toBe(true);
    expect(isLeaseStale('nonsense', T0, ttlMs)).toBe(true);
  });
});

describe('isLaneAcquirable', () => {
  const base = { lane: 1, exists: true, dirtyOrAhead: { dirty: false, ahead: 0 }, lease: null };
  it('a clean, unleased, existing lane is acquirable', () => {
    expect(isLaneAcquirable(base, T0, ttlMs)).toBe(true);
  });
  it('a missing lane is never acquirable', () => {
    expect(isLaneAcquirable({ ...base, exists: false }, T0, ttlMs)).toBe(false);
  });
  it('a lane with uncommitted work is protected (not acquirable) — #2267', () => {
    expect(isLaneAcquirable({ ...base, dirtyOrAhead: { dirty: true, ahead: 0 } }, T0, ttlMs)).toBe(false);
  });
  it('a lane with unpushed commits (ahead) is protected (not acquirable) — #2267', () => {
    expect(isLaneAcquirable({ ...base, dirtyOrAhead: { dirty: false, ahead: 2 } }, T0, ttlMs)).toBe(false);
  });
  it('a lane with a LIVE lease is off-limits', () => {
    expect(isLaneAcquirable({ ...base, lease: leaseAt(0) }, T0, ttlMs)).toBe(false);
  });
  it('a lane with a STALE lease is reclaimable', () => {
    expect(isLaneAcquirable({ ...base, lease: leaseAt(-(DEFAULT_LEASE_TTL_MINUTES + 1)) }, T0, ttlMs)).toBe(true);
  });
});

describe('chooseFreeLane', () => {
  const mk = (lane, over = {}) => ({ lane, exists: true, dirtyOrAhead: { dirty: false, ahead: 0 }, lease: null, ...over });
  it('picks the lowest-index acquirable lane (deterministic — concurrent acquirers converge, O_EXCL breaks the tie)', () => {
    const infos = [mk(3), mk(1), mk(2)];
    expect(chooseFreeLane(infos, T0, ttlMs)).toBe(1);
  });
  it('skips held/dirty lanes and picks the next free one', () => {
    const infos = [
      mk(1, { lease: leaseAt(0) }),                         // held
      mk(2, { dirtyOrAhead: { dirty: true, ahead: 0 } }),   // dirty
      mk(3),                                                // free ← winner
    ];
    expect(chooseFreeLane(infos, T0, ttlMs)).toBe(3);
  });
  it('reclaims a stale-leased lane when nothing else is free', () => {
    const infos = [mk(1, { lease: leaseAt(0) }), mk(2, { lease: leaseAt(-(DEFAULT_LEASE_TTL_MINUTES + 5)) })];
    expect(chooseFreeLane(infos, T0, ttlMs)).toBe(2);
  });
  it('returns null when the whole pool is held/busy', () => {
    const infos = [mk(1, { lease: leaseAt(0) }), mk(2, { dirtyOrAhead: { dirty: true, ahead: 0 } })];
    expect(chooseFreeLane(infos, T0, ttlMs)).toBeNull();
  });
});

describe('leaseBody / describeLease / leaseOwnedBy', () => {
  it('leaseBody normalizes optional fields', () => {
    const b = leaseBody({ session: 's', acquiredAt: '2026-07-05T12:00:00.000Z' });
    expect(b).toMatchObject({ session: 's', purpose: null, ttlMinutes: DEFAULT_LEASE_TTL_MINUTES, host: null, pid: null, ownerSession: null });
  });
  it('leaseBody carries an explicit pid + ownerSession through unchanged (#2367)', () => {
    const b = leaseBody({ session: 's', acquiredAt: '2026-07-05T12:00:00.000Z', pid: 111, ownerSession: 'sess-uuid-A' });
    expect(b.pid).toBe(111);
    expect(b.ownerSession).toBe('sess-uuid-A');
  });
  it('leaseBody no longer carries an ancestry field (r2 — pid-ancestry removed)', () => {
    const b = leaseBody({ session: 's', acquiredAt: '2026-07-05T12:00:00.000Z', pid: 111, ownerSession: 'sess-uuid-A' });
    expect('ancestry' in b).toBe(false);
  });
  it('leaseBody defaults workflowLane to false and carries an explicit true through (#2413)', () => {
    expect(leaseBody({ session: 's', acquiredAt: '2026-07-05T12:00:00.000Z' }).workflowLane).toBe(false);
    expect(leaseBody({ session: 's', acquiredAt: '2026-07-05T12:00:00.000Z', workflowLane: true }).workflowLane).toBe(true);
  });
  it('leaseBody OMITS predictedScope when no scope is declared — byte-identical marker to today (#2560)', () => {
    const b = leaseBody({ session: 's', acquiredAt: '2026-07-05T12:00:00.000Z' });
    expect('predictedScope' in b).toBe(false);
    expect(b.predictedScope).toBeUndefined();
  });
  it('leaseBody carries a non-empty predictedScope array through (#2560)', () => {
    const b = leaseBody({ session: 's', acquiredAt: '2026-07-05T12:00:00.000Z', predictedScope: ['we:a', 'we:b'] });
    expect(b.predictedScope).toEqual(['we:a', 'we:b']);
  });
  it('leaseBody OMITS an empty predictedScope array (omit-when-empty, #2560)', () => {
    const b = leaseBody({ session: 's', acquiredAt: '2026-07-05T12:00:00.000Z', predictedScope: [] });
    expect('predictedScope' in b).toBe(false);
  });
  it('describeLease renders who + purpose + when', () => {
    const s = describeLease(leaseBody({ session: 'drain-1', purpose: 'drain', acquiredAt: '2026-07-05T12:00:00.000Z' }));
    expect(s).toContain('drain-1');
    expect(s).toContain('drain');
  });
  it('leaseOwnedBy matches only the owning session', () => {
    const lease = leaseBody({ session: 'sess-a', acquiredAt: '2026-07-05T12:00:00.000Z' });
    expect(leaseOwnedBy(lease, 'sess-a')).toBe(true);
    expect(leaseOwnedBy(lease, 'sess-b')).toBe(false);
    expect(leaseOwnedBy(null, 'sess-a')).toBe(false);
  });
});

describe('isForeignLease (#2367 r2 — durable ownerSession is the SOLE ownership signal)', () => {
  const at = '2026-07-05T12:00:00.000Z';
  it('a live lease whose ownerSession differs from mine is FOREIGN (deny)', () => {
    const lease = leaseBody({ session: 's', acquiredAt: at, ownerSession: 'sess-A' });
    expect(isForeignLease({ lease, mySessionId: 'sess-B' })).toBe(true);
  });
  it('my own lease (ownerSession === mySessionId) is NOT foreign (allow)', () => {
    const lease = leaseBody({ session: 's', acquiredAt: at, ownerSession: 'sess-A' });
    expect(isForeignLease({ lease, mySessionId: 'sess-A' })).toBe(false);
  });
  it('DEGRADED — a lease with no ownerSession ⇒ fail-open (allow, not foreign)', () => {
    const lease = leaseBody({ session: 's', acquiredAt: at }); // ownerSession null (older lease / env unset at acquire)
    expect(isForeignLease({ lease, mySessionId: 'sess-B' })).toBe(false);
  });
  it('DEGRADED — the caller has no mySessionId ⇒ fail-open (allow), even though the lease carries one', () => {
    const lease = leaseBody({ session: 's', acquiredAt: at, ownerSession: 'sess-A' });
    expect(isForeignLease({ lease, mySessionId: null })).toBe(false);
    expect(isForeignLease({ lease, mySessionId: '' })).toBe(false);
  });
  it('no lease ⇒ never foreign; empty args never throw', () => {
    expect(isForeignLease({ lease: null, mySessionId: 'sess-A' })).toBe(false);
    expect(isForeignLease({})).toBe(false);
    expect(isForeignLease()).toBe(false);
  });
});

describe('leaseOwnedByCaller (#2452 Gap 2 — release ownership survives a defaultSession() host:pid change)', () => {
  const at = '2026-07-05T12:00:00.000Z';
  it('exact session match wins first (legacy / explicit --session flow, unchanged)', () => {
    const lease = leaseBody({ session: 'sess-a', acquiredAt: at });
    expect(leaseOwnedByCaller({ lease, session: 'sess-a', mySessionId: null })).toBe(true);
  });
  it('an UNMARKED lease: the acquiring session releases it via ownerSession even though its host:pid `session` string changed', () => {
    // Simulates: acquire ran as `host:111` (a since-exited pid), release runs as `host:222` — the exact bug
    // (`defaultSession()`'s ppid differs per shell invocation). ownerSession (CLAUDE_CODE_SESSION_ID) is
    // stable across both calls, so ownership is still recognized — for a TARGETED `--lane=N` release.
    const lease = leaseBody({ session: 'host:111', acquiredAt: at, ownerSession: 'sess-uuid-A' });
    expect(leaseOwnedByCaller({ lease, session: 'host:222', mySessionId: 'sess-uuid-A', targeted: true })).toBe(true);
  });
  it('an UNMARKED lease genuinely owned by a DIFFERENT session (different ownerSession, no session-string match) is NOT owned', () => {
    const lease = leaseBody({ session: 'host:111', acquiredAt: at, ownerSession: 'sess-uuid-A' });
    expect(leaseOwnedByCaller({ lease, session: 'host:222', mySessionId: 'sess-uuid-B', targeted: true })).toBe(false);
  });

  // #2452 review — the SWEEP carve-out. `workflowLane` is NOT the marker of a shared `ownerSession`: it is set
  // only for `--purpose=workflow-lane`, while the conveyor's concurrently-dispatched lanes
  // (`conveyor-delivery` / `conveyor-fix` / `conveyor-prepare-*`) are UNMARKED and still share one
  // `ownerSession`, because #2413 says a spawned subagent inherits the parent's id verbatim. Keying the
  // carve-out on `workflowLane` therefore left every unmarked sibling exposed: a bare `release --all` (which
  // targets EVERY held lane) dropped their live holds with no `--force`, and the next acquire runs
  // `checkout -B --force` + `clean -fd` on the clone the sibling was still working in. Two real lanes observed
  // in this shape: lane-1 {purpose:'review-loop-model-tiers'} and lane-2 {purpose:'2864-ledger-sha'} — one
  // ownerSession, different `session` strings, both unmarked.
  it('two UNMARKED siblings sharing one ownerSession are NOT mutually owned in a SWEEP (targeted:false)', () => {
    const sibling = leaseBody({ session: 'Mac:23707', acquiredAt: at, ownerSession: 'sess-uuid-shared' });
    // the sweeping caller is the same session (shared id) but a different shell invocation / logical holder
    expect(leaseOwnedByCaller({ lease: sibling, session: 'Mac:93309', mySessionId: 'sess-uuid-shared' })).toBe(false);
    expect(leaseOwnedByCaller({ lease: sibling, session: 'Mac:93309', mySessionId: 'sess-uuid-shared', targeted: false })).toBe(false);
    // …but naming that one lane explicitly still releases it — the fallback is preserved where intent is clear.
    expect(leaseOwnedByCaller({ lease: sibling, session: 'Mac:93309', mySessionId: 'sess-uuid-shared', targeted: true })).toBe(true);
  });
  it('a SWEEP still releases on an exact `session` match — the pre-#2452 rule is untouched', () => {
    const mine = leaseBody({ session: 'Mac:93309', acquiredAt: at, ownerSession: 'sess-uuid-shared' });
    expect(leaseOwnedByCaller({ lease: mine, session: 'Mac:93309', mySessionId: 'sess-uuid-shared' })).toBe(true);
  });
  it('`targeted` defaults to false — the conservative posture for any caller that omits it', () => {
    const lease = leaseBody({ session: 'host:111', acquiredAt: at, ownerSession: 'sess-uuid-A' });
    expect(leaseOwnedByCaller({ lease, session: 'host:222', mySessionId: 'sess-uuid-A' })).toBe(false);
  });
  // #2452 review — this case previously asserted FAIL-OPEN (`toBe(true)`), inheriting isForeignLease's
  // posture. That was an authorization weakening, not a fix: isForeignLease answers "is this PROVABLY someone
  // else's?" and returns false on no signal, so `!isForeignLease(...)` handed ANY caller ownership of an
  // unmarked lease that recorded no ownerSession — strictly weaker than the exact-session match this fallback
  // was meant to supplement, and a live hold could be dropped without --force. Ownership now needs a POSITIVE
  // match on both sides; no signal means not owned, so the explicit --force is required.
  it('DEGRADED (no ownerSession recorded) is NOT owned — the durable-id fallback needs a positive match', () => {
    const lease = leaseBody({ session: 'host:111', acquiredAt: at }); // no ownerSession recorded
    expect(leaseOwnedByCaller({ lease, session: 'host:222', mySessionId: 'sess-uuid-B', targeted: true })).toBe(false);
  });
  it('DEGRADED (caller has no mySessionId) is NOT owned either — both sides must be present and equal', () => {
    const lease = leaseBody({ session: 'host:111', acquiredAt: at, ownerSession: 'sess-uuid-A' });
    expect(leaseOwnedByCaller({ lease, session: 'host:222', mySessionId: null, targeted: true })).toBe(false);
    expect(leaseOwnedByCaller({ lease, session: 'host:222', mySessionId: '', targeted: true })).toBe(false);
  });
  it('a RESERVED lease is never owned via the ownerSession fallback — #2350 keeps --release-reserved the ONE un-reserve', () => {
    // ownerSession is minted on EVERY lease, reserved ones included, so without this carve-out an ordinary
    // `release` from the minting session would silently drop a PERMANENT reserved lane with no flag —
    // exactly what "#2350: --force alone never drops one" forbids.
    const lease = leaseBody({ session: 'reserved-slug', acquiredAt: at, ownerSession: 'sess-uuid-A', reserved: true });
    expect(leaseOwnedByCaller({ lease, session: 'host:222', mySessionId: 'sess-uuid-A', targeted: true })).toBe(false);
    // the exact minted-slug match still identifies it (the --release-reserved path does the un-reserving).
    expect(leaseOwnedByCaller({ lease, session: 'reserved-slug', mySessionId: 'sess-uuid-A', targeted: true })).toBe(true);
  });
  it('a MARKED (workflowLane) lease is owned ONLY via its exact minted-slug session match — ownerSession never substitutes, because siblings share it', () => {
    const lease = leaseBody({ session: 'batch-x-lane5', acquiredAt: at, ownerSession: 'sess-uuid-shared', workflowLane: true });
    // A sibling lane under the SAME orchestrator session (shared ownerSession) but a DIFFERENT minted slug must
    // NOT read as owned — that would let one sibling release another sibling's lane. True even when TARGETED.
    expect(leaseOwnedByCaller({ lease, session: 'batch-x-lane6', mySessionId: 'sess-uuid-shared', targeted: true })).toBe(false);
    // The correct slug, asserted as `session`, still owns it.
    expect(leaseOwnedByCaller({ lease, session: 'batch-x-lane5', mySessionId: 'sess-uuid-shared', targeted: true })).toBe(true);
  });
  it('no lease ⇒ never owned; empty args never throw', () => {
    expect(leaseOwnedByCaller({ lease: null, session: 's', mySessionId: 'x', targeted: true })).toBe(false);
    expect(leaseOwnedByCaller({})).toBe(false);
    expect(leaseOwnedByCaller()).toBe(false);
  });
});

describe('laneMarkedSlug / assertedLaneSlug (#2413 — the marked-lease per-op slug channel)', () => {
  const at = '2026-07-05T12:00:00.000Z';
  it('WORKFLOW_LANE_PURPOSE is the sanctioned purpose token', () => {
    expect(WORKFLOW_LANE_PURPOSE).toBe('workflow-lane');
  });
  it('laneMarkedSlug returns the minted session slug ONLY for a marked lease', () => {
    expect(laneMarkedSlug(leaseBody({ session: 'batch-x-2427', acquiredAt: at, workflowLane: true }))).toBe('batch-x-2427');
    expect(laneMarkedSlug(leaseBody({ session: 'batch-x-2427', acquiredAt: at }))).toBeNull(); // unmarked
    expect(laneMarkedSlug({ workflowLane: true })).toBeNull(); // marked but slug-less → nothing to assert
    expect(laneMarkedSlug(null)).toBeNull();
  });
  it('assertedLaneSlug parses an inline LANE_SESSION=<slug>, stopping at whitespace / operators', () => {
    expect(assertedLaneSlug('LANE_SESSION=batch-x-2427 git reset --hard origin/main')).toBe('batch-x-2427');
    expect(assertedLaneSlug('git reset --hard')).toBeNull();                       // absent
    expect(assertedLaneSlug('LANE_SESSION=new-my.slug/1 node scripts/x.mjs')).toBe('new-my.slug/1'); // slug chars
    expect(assertedLaneSlug('FOO=1 LANE_SESSION=s2 git clean -fd')).toBe('s2');     // amid other assignments
    expect(assertedLaneSlug('')).toBeNull();
    expect(assertedLaneSlug(undefined)).toBeNull();
  });
});
