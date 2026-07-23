/**
 * @file scripts/readiness/__tests__/drain-lock.test.mjs
 * @description Unit proof of the drain's DUAL-LOCK guard (#2391) — the numbering-critical-section MUTEX and
 *   the whole-process drain LEASE, both built on the file-locks atomic-dir + TTL-lease primitive. Drives the
 *   thin drain-specific wiring against a REAL temp lock root (never the machine-global home dir), with an
 *   injected clock so the TTL/heartbeat paths are exercised deterministically. Covers the three item proofs:
 *   concurrent lands serialize with no duplicate NNN; a second drain launch no-ops on a held lease; a stale
 *   lease is reclaimable.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readLockEntry } from '../file-locks.mjs';
import {
  NUMBERING_LOCK_PATH, DRAIN_LEASE_PATH,
  makeOwner, tryAcquireNumberingLock, releaseNumberingLockIfOwned, withNumberingLock,
  acquireDrainLease, heartbeatDrainLease, releaseDrainLease, drainLeaseStatus,
} from '../drain-lock.mjs';

const T0 = Date.parse('2026-07-10T12:00:00.000Z');
const MIN = 60_000;

let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'drain-lock-')); });
afterEach(() => { try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort */ } });

describe('numbering-critical-section mutex — sole-serial-writer (#2391)', () => {
  it('BLOCKS a second entrant while the first holds the section (no interleaved number+publish)', () => {
    // Land A holds the mutex, its lease fresh.
    expect(tryAcquireNumberingLock(root, 'A', { nowMs: T0, leaseMinutes: 5 }).ok).toBe(true);
    // Land B tries the wrapped section with a bounded wait; a fake clock advances per poll but never reaches
    // A's 5-min lease, so B can NEVER acquire while A holds it.
    let clock = T0;
    const now = () => clock;
    const sleep = () => { clock += 100; };
    let ran = 0;
    const r = withNumberingLock(() => { ran++; return 'B'; }, { lockRoot: root, owner: 'B', waitMs: 1000, pollMs: 100, leaseMinutes: 5, now, sleep });
    expect(r.held).toBe(false);       // B never seized the lock while A held it → mutual exclusion
    expect(r.heldBy).toBe('A');
    expect(r.contended).toBe(true);   // blocked past the budget → fell through un-locked rather than HANG
    expect(ran).toBe(1);              // the land never wedges: fn still ran (the never-hang fallback)
    // A still owns the lock (B's fallback never stomped it).
    expect(readLockEntry(root, NUMBERING_LOCK_PATH).owner).toBe('A');
  });

  it('once the holder releases, the next entrant acquires and runs INSIDE the lock, then frees it', () => {
    tryAcquireNumberingLock(root, 'A', { nowMs: T0 });
    releaseNumberingLockIfOwned(root, 'A');
    const r = withNumberingLock(() => 42, { lockRoot: root, owner: 'B', now: () => T0 });
    expect(r).toMatchObject({ held: true, contended: false, result: 42 });
    expect(readLockEntry(root, NUMBERING_LOCK_PATH)).toBeNull(); // released after the section
  });

  it('two mutex-guarded lands assign DISTINCT NNNs — never a duplicate number', () => {
    let maxNum = 100;
    const numberStep = () => ++maxNum; // the number step the mutex serializes: max+1
    const r1 = withNumberingLock(() => numberStep(), { lockRoot: root, owner: 'L1', now: () => T0 });
    const r2 = withNumberingLock(() => numberStep(), { lockRoot: root, owner: 'L2', now: () => T0 });
    expect(r1.result).toBe(101);
    expect(r2.result).toBe(102);      // distinct — serialization means L2 sees L1's increment
    expect(r1.held && r2.held).toBe(true);
  });

  it('a STALE numbering lock (a crashed holder) is reclaimed via the TTL — the section never wedges', () => {
    tryAcquireNumberingLock(root, 'DEAD', { nowMs: T0, leaseMinutes: 5 });
    const later = T0 + 6 * MIN; // heartbeat now 6 min old vs a 5-min lease → reclaimable
    const r = withNumberingLock(() => 'ok', { lockRoot: root, owner: 'FRESH', leaseMinutes: 5, now: () => later });
    expect(r).toMatchObject({ held: true, reason: 'lease-expired', result: 'ok' });
  });

  it('releaseNumberingLockIfOwned never stomps a reclaimer that seized the section', () => {
    tryAcquireNumberingLock(root, 'A', { nowMs: T0, leaseMinutes: 5 });
    tryAcquireNumberingLock(root, 'B', { nowMs: T0 + 6 * MIN, leaseMinutes: 5 }); // B reclaims A's stale lock
    expect(releaseNumberingLockIfOwned(root, 'A')).toBe(false);                    // A's late release is a no-op
    expect(readLockEntry(root, NUMBERING_LOCK_PATH).owner).toBe('B');              // B's lock intact
  });
});

describe('whole-process drain lease — one drain at a time (#2391)', () => {
  it('a second drain launch NO-OPS on a live lease', () => {
    expect(acquireDrainLease(root, 'drainA', { nowMs: T0, leaseMinutes: 15 }).ok).toBe(true);
    const b = acquireDrainLease(root, 'drainB', { nowMs: T0 + MIN, leaseMinutes: 15 });
    expect(b).toMatchObject({ ok: false, reason: 'held', heldBy: 'drainA' });
    expect(drainLeaseStatus(root, { nowMs: T0 + MIN, leaseMinutes: 15 })).toMatchObject({ held: true, stale: false, owner: 'drainA' });
  });

  it('a STALE lease (a crashed drain) is reclaimable', () => {
    acquireDrainLease(root, 'drainA', { nowMs: T0, leaseMinutes: 15 });
    const stale = T0 + 16 * MIN; // heartbeat 16 min old vs a 15-min lease
    expect(drainLeaseStatus(root, { nowMs: stale, leaseMinutes: 15 })).toMatchObject({ held: false, stale: true, owner: 'drainA' });
    expect(acquireDrainLease(root, 'drainB', { nowMs: stale, leaseMinutes: 15 }).ok).toBe(true); // reclaimed via TTL
    expect(drainLeaseStatus(root, { nowMs: stale, leaseMinutes: 15 }).owner).toBe('drainB');
  });

  it('a heartbeat keeps a running drain live (not reclaimed under it)', () => {
    acquireDrainLease(root, 'drainA', { nowMs: T0, leaseMinutes: 15 });
    expect(heartbeatDrainLease(root, 'drainA', { nowMs: T0 + 14 * MIN })).toBe(true); // refresh before the TTL
    expect(drainLeaseStatus(root, { nowMs: T0 + 16 * MIN, leaseMinutes: 15 }).held).toBe(true); // 2 min past the refresh → still live
    // A stranger's heartbeat is a no-op (it does not own the lease).
    expect(heartbeatDrainLease(root, 'stranger', { nowMs: T0 + 14 * MIN })).toBe(false);
  });

  it('release frees the lease only for its owner (never stomps a reclaimer)', () => {
    acquireDrainLease(root, 'drainA', { nowMs: T0, leaseMinutes: 15 });
    acquireDrainLease(root, 'drainB', { nowMs: T0 + 16 * MIN, leaseMinutes: 15 }); // B reclaims after the TTL
    expect(releaseDrainLease(root, 'drainA')).toBe(false);                          // A's stale release is a no-op
    expect(drainLeaseStatus(root, { nowMs: T0 + 16 * MIN, leaseMinutes: 15 }).owner).toBe('drainB');
    expect(releaseDrainLease(root, 'drainB')).toBe(true);                           // B frees its own
    expect(drainLeaseStatus(root).owner).toBeNull();
  });

  it('the mutex and the lease are DISTINCT locks (never alias)', () => {
    tryAcquireNumberingLock(root, 'num', { nowMs: T0 });
    acquireDrainLease(root, 'drain', { nowMs: T0 });
    expect(readLockEntry(root, NUMBERING_LOCK_PATH).owner).toBe('num');
    expect(readLockEntry(root, DRAIN_LEASE_PATH).owner).toBe('drain');
    expect(NUMBERING_LOCK_PATH).not.toBe(DRAIN_LEASE_PATH);
  });

  it('makeOwner is stable per (host,pid,kind) and distinguishes kinds', () => {
    expect(makeOwner('drain')).toBe(makeOwner('drain'));
    expect(makeOwner('drain')).not.toBe(makeOwner('numbering'));
  });
});

describe('drain lease REPO-SCOPE metadata (#2458)', () => {
  it('records the drain repo scope in the lease and surfaces it via drainLeaseStatus (de-duped + sorted)', () => {
    acquireDrainLease(root, 'drainA', { nowMs: T0, scope: ['o/plateau-app', 'o/we', 'o/we'] });
    const st = drainLeaseStatus(root, { nowMs: T0 });
    expect(st.owner).toBe('drainA');
    expect(st.scope).toEqual(['o/plateau-app', 'o/we']); // normalized: unique + sorted
  });

  it('a lease acquired WITHOUT a scope has scope null (legacy/unscoped holder → gate treats as covers-all)', () => {
    acquireDrainLease(root, 'drainA', { nowMs: T0 });
    expect(drainLeaseStatus(root, { nowMs: T0 }).scope).toBeNull();
    expect(readLockEntry(root, DRAIN_LEASE_PATH).meta).toBeUndefined(); // no meta key when there is nothing to record
  });

  it('the recorded scope SURVIVES a heartbeat that supplies no scope (the resident-daemon case)', () => {
    acquireDrainLease(root, 'drainA', { nowMs: T0, scope: ['o/we'] });
    expect(heartbeatDrainLease(root, 'drainA', { nowMs: T0 + 5 * MIN })).toBe(true); // no scope re-supplied
    expect(drainLeaseStatus(root, { nowMs: T0 + 6 * MIN }).scope).toEqual(['o/we']); // preserved, not dropped
  });

  it('a heartbeat MAY refresh the scope when the holder re-supplies it', () => {
    acquireDrainLease(root, 'drainA', { nowMs: T0, scope: ['o/we'] });
    heartbeatDrainLease(root, 'drainA', { nowMs: T0 + 5 * MIN, scope: ['o/we', 'o/frontierui'] });
    expect(drainLeaseStatus(root, { nowMs: T0 + 6 * MIN }).scope).toEqual(['o/frontierui', 'o/we']);
  });

  it('re-acquiring an OWN live lease with no scope carries the recorded scope forward (never silently dropped)', () => {
    acquireDrainLease(root, 'drainA', { nowMs: T0, scope: ['o/we'] });
    expect(acquireDrainLease(root, 'drainA', { nowMs: T0 + MIN }).ok).toBe(true); // own re-acquire (reserve 'own' path), no scope re-supplied
    expect(drainLeaseStatus(root, { nowMs: T0 + 2 * MIN }).scope).toEqual(['o/we']);
  });

  it('reclaiming a STALE foreign lease does NOT inherit the dead holder\'s scope', () => {
    acquireDrainLease(root, 'drainA', { nowMs: T0, scope: ['o/we'] });
    const stale = T0 + 16 * MIN; // past the 15-min TTL
    expect(acquireDrainLease(root, 'drainB', { nowMs: stale }).ok).toBe(true); // B reclaims, supplies no scope
    expect(drainLeaseStatus(root, { nowMs: stale }).scope).toBeNull(); // B's lease is unscoped, not A's old scope
  });
});
