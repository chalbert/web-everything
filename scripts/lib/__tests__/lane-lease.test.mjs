/**
 * @file lane-lease.test.mjs — proof of the #2275 lease-decision core: staleness (TTL reclaim),
 *   acquirability (dirty/ahead + live-lease exclusion), and free-lane choice (lowest-index, deterministic).
 *   All pure — `lane-pool.mjs` supplies the IO (atomic O_EXCL create, git reset, status).
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LEASE_TTL_MINUTES,
  isLeaseStale,
  isLaneAcquirable,
  chooseFreeLane,
  leaseBody,
  describeLease,
  leaseOwnedBy,
  ancestryOverlaps,
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
    expect(b).toMatchObject({ session: 's', purpose: null, ttlMinutes: DEFAULT_LEASE_TTL_MINUTES, host: null, pid: null, ancestry: null });
  });
  it('leaseBody carries an explicit ancestry array through unchanged (#2367)', () => {
    const b = leaseBody({ session: 's', acquiredAt: '2026-07-05T12:00:00.000Z', pid: 111, ancestry: [111, 222, 333] });
    expect(b.pid).toBe(111);
    expect(b.ancestry).toEqual([111, 222, 333]);
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

describe('ancestryOverlaps (#2367 — the leaseholder-identity decision, no session-id)', () => {
  it('true when my ancestry shares ANY pid with the lease-recorded ancestry (the common session anchor)', () => {
    const lease = leaseBody({ session: 's', acquiredAt: '2026-07-05T12:00:00.000Z', pid: 501, ancestry: [501, 400, 100] });
    expect(ancestryOverlaps([777, 400, 1], lease)).toBe(true); // 400 is the shared long-lived anchor
  });
  it('false when the chains never intersect (a genuinely different session)', () => {
    const lease = leaseBody({ session: 's', acquiredAt: '2026-07-05T12:00:00.000Z', pid: 501, ancestry: [501, 400, 100] });
    expect(ancestryOverlaps([888, 999, 1], lease)).toBe(false);
  });
  it('a single captured pid does NOT survive as an ancestor of a LATER, unrelated call — this is exactly why the check is chain-overlap, not scalar match', () => {
    // The acquiring process (pid 501) is a leaf that already exited by the time a LATER, separate Bash-tool
    // call runs — a later call's OWN live ancestry never re-observes it. A "mine" chain built purely from
    // pids unrelated to 501 (its own fresh wrapper + whatever it walks up through) has no overlap UNLESS it
    // also passes through the shared upstream anchor (400) — which is exactly what makes ownership detectable.
    const lease = leaseBody({ session: 's', acquiredAt: '2026-07-05T12:00:00.000Z', pid: 501, ancestry: [501, 400, 100] });
    expect(ancestryOverlaps([999], lease)).toBe(false);       // unrelated later chain, hasn't reached the anchor yet
    expect(ancestryOverlaps([999, 400], lease)).toBe(true);   // …reaching the shared anchor is what makes it "mine"
  });
  it('falls back to a single-value lease.pid when ancestry was never recorded (an older lease, pre-#2367)', () => {
    const lease = { session: 's', acquiredAt: '2026-07-05T12:00:00.000Z', pid: 400, ancestry: null };
    expect(ancestryOverlaps([777, 400, 1], lease)).toBe(true);
    expect(ancestryOverlaps([777, 999, 1], lease)).toBe(false);
  });
  it('false on empty/missing inputs — never throws, never accidentally "mine"', () => {
    expect(ancestryOverlaps([], leaseBody({ session: 's', acquiredAt: '2026-07-05T12:00:00.000Z', ancestry: [1, 2] }))).toBe(false);
    expect(ancestryOverlaps([1, 2], null)).toBe(false);
    expect(ancestryOverlaps(undefined, leaseBody({ session: 's', acquiredAt: '2026-07-05T12:00:00.000Z', ancestry: [1, 2] }))).toBe(false);
    expect(ancestryOverlaps([1, 2], { session: 's', ancestry: [] , pid: null })).toBe(false);
  });
});
