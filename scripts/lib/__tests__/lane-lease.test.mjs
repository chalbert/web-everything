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
