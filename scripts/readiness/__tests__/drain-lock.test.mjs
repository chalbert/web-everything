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
  makeOwner, tryAcquireNumberingLock, releaseNumberingLockIfOwned, withNumberingLock, withLandWriteLock,
  acquireDrainLease, heartbeatDrainLease, releaseDrainLease, drainLeaseStatus,
  drainLeasePathFor, localRepoSlug,
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

describe('withLandWriteLock — the merge write shares the serial-writer mutex (#2683)', () => {
  it('a merge write BLOCKS while a numbering section holds the SAME lock key (mutual exclusion across the two)', () => {
    // A numbering land holds the mutex; a concurrent merge write must NOT proceed under the lock — they share
    // NUMBERING_LOCK_PATH, so the merge is what a --only fast drain serializes against a resident-daemon sweep.
    expect(tryAcquireNumberingLock(root, 'NUMBERING', { nowMs: T0, leaseMinutes: 5 }).ok).toBe(true);
    let clock = T0;
    const r = withLandWriteLock(() => 'merged', { lockRoot: root, waitMs: 500, pollMs: 100, leaseMinutes: 5, now: () => clock, sleep: () => { clock += 100; } });
    expect(r.held).toBe(false);        // never seized while numbering held it
    expect(r.heldBy).toBe('NUMBERING');
    expect(r.contended).toBe(true);    // never-hang fallback — the merge still ran (fn), the idempotency guard is the backstop
    expect(r.result).toBe('merged');
    expect(readLockEntry(root, NUMBERING_LOCK_PATH).owner).toBe('NUMBERING'); // the fallback never stomped the holder
  });

  it('two merge writes serialize on the shared key and release after each section', () => {
    const r1 = withLandWriteLock(() => 'A', { lockRoot: root, now: () => T0 });
    expect(r1).toMatchObject({ held: true, contended: false, result: 'A' });
    expect(readLockEntry(root, NUMBERING_LOCK_PATH)).toBeNull(); // released → the next writer can acquire
    const r2 = withLandWriteLock(() => 'B', { lockRoot: root, now: () => T0 });
    expect(r2).toMatchObject({ held: true, result: 'B' });
  });

  it('tags the owner "land" (diagnostics) while sharing the numbering lock key for exclusion', () => {
    let seenOwner = null;
    withLandWriteLock(() => { seenOwner = readLockEntry(root, NUMBERING_LOCK_PATH)?.owner; }, { lockRoot: root, now: () => T0 });
    expect(seenOwner).toMatch(/:land$/); // makeOwner('land')
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

describe('drain lease PER-REPO key (#3440 — one project\'s daemon never blocks another\'s)', () => {
  it('drainLeasePathFor: distinct repoKeys ⇒ distinct lock paths; null ⇒ the legacy global sentinel', () => {
    expect(drainLeasePathFor('o/web-everything')).not.toBe(drainLeasePathFor('o/plateau-app'));
    expect(drainLeasePathFor(null)).toBe(DRAIN_LEASE_PATH);
    expect(drainLeasePathFor()).toBe(DRAIN_LEASE_PATH);
    // both repo-keyed paths still derive from (and so remain distinguishable from) the base sentinel
    expect(drainLeasePathFor('o/web-everything')).toContain(DRAIN_LEASE_PATH);
  });

  it('THE CORE PROOF: two DIFFERENT repos\' drain runs hold their OWN leases concurrently on the same machine', () => {
    // Mirrors the #3440 incident: plateau-app's resident daemon (repoKey 'o/plateau-app') holds a live lease
    // while web-everything's own drain (repoKey 'o/web-everything') tries to acquire ITS lease on the SAME
    // lock root (a shared machine-global home, #91's whole point). Before this fix both shared ONE lock dir
    // (repoKey ignored) so the second acquire would have been BLOCKED; now it is NOT.
    expect(acquireDrainLease(root, 'plateau-daemon', { nowMs: T0, repoKey: 'o/plateau-app' }).ok).toBe(true);
    const weAcquire = acquireDrainLease(root, 'we-drain', { nowMs: T0 + MIN, repoKey: 'o/web-everything' });
    expect(weAcquire.ok).toBe(true); // NOT blocked by the other repo's live lease
    // Both leases are independently live, each reporting its OWN owner — proving true concurrency, not a race
    // where the second silently stomped the first.
    expect(drainLeaseStatus(root, { nowMs: T0 + MIN, repoKey: 'o/plateau-app' })).toMatchObject({ held: true, owner: 'plateau-daemon' });
    expect(drainLeaseStatus(root, { nowMs: T0 + MIN, repoKey: 'o/web-everything' })).toMatchObject({ held: true, owner: 'we-drain' });
  });

  it('the SAME repoKey still mutually excludes — the sole-serial-writer invariant is preserved WITHIN one repo', () => {
    expect(acquireDrainLease(root, 'drainA', { nowMs: T0, repoKey: 'o/web-everything' }).ok).toBe(true);
    const second = acquireDrainLease(root, 'drainB', { nowMs: T0 + MIN, repoKey: 'o/web-everything' });
    expect(second).toMatchObject({ ok: false, reason: 'held', heldBy: 'drainA' });
  });

  it('heartbeat and release are scoped by repoKey — they act on THAT repo\'s lease only, never a stranger repo\'s', () => {
    acquireDrainLease(root, 'we-drain', { nowMs: T0, repoKey: 'o/web-everything' });
    acquireDrainLease(root, 'plateau-daemon', { nowMs: T0, repoKey: 'o/plateau-app' });
    // Heartbeating the WE lease never touches plateau-app's, and vice versa.
    expect(heartbeatDrainLease(root, 'we-drain', { nowMs: T0 + MIN, repoKey: 'o/web-everything' })).toBe(true);
    expect(heartbeatDrainLease(root, 'we-drain', { nowMs: T0 + MIN, repoKey: 'o/plateau-app' })).toBe(false); // wrong repo's lease — not owned there
    // Releasing WE's lease leaves plateau-app's fully intact.
    expect(releaseDrainLease(root, 'we-drain', { repoKey: 'o/web-everything' })).toBe(true);
    expect(drainLeaseStatus(root, { nowMs: T0 + MIN, repoKey: 'o/web-everything' }).held).toBe(false);
    expect(drainLeaseStatus(root, { nowMs: T0 + MIN, repoKey: 'o/plateau-app' })).toMatchObject({ held: true, owner: 'plateau-daemon' });
  });

  it('a repoKey-scoped lease is invisible to a legacy (repoKey-less) status read — distinct lock dirs, not a filter', () => {
    acquireDrainLease(root, 'we-drain', { nowMs: T0, repoKey: 'o/web-everything' });
    expect(drainLeaseStatus(root, { nowMs: T0 }).held).toBe(false); // the legacy global path never saw this acquire
    acquireDrainLease(root, 'legacy-drain', { nowMs: T0 });
    expect(drainLeaseStatus(root, { nowMs: T0 }).owner).toBe('legacy-drain');
    expect(drainLeaseStatus(root, { nowMs: T0, repoKey: 'o/web-everything' }).owner).toBe('we-drain'); // untouched
  });

  describe('localRepoSlug — the invoking checkout\'s own repo identity, parsed from `git remote get-url origin`', () => {
    it('parses an https origin URL to an org/repo slug', () => {
      const exec = () => 'https://github.com/chalbert/web-everything.git\n';
      expect(localRepoSlug({ exec })).toBe('chalbert/web-everything');
    });
    it('parses an ssh origin URL (no .git suffix) the same way', () => {
      const exec = () => 'git@github.com:chalbert/plateau-app\n';
      expect(localRepoSlug({ exec })).toBe('chalbert/plateau-app');
    });
    it('returns null when git/origin is unavailable (no remote, detached, not a repo) — never throws', () => {
      const exec = () => { throw new Error('fatal: not a git repository'); };
      expect(localRepoSlug({ exec })).toBeNull();
    });
    it('threads `cwd` through to the git call, so it reads the RIGHT checkout\'s origin', () => {
      let seenCwd = null;
      const exec = (_cmd, _args, opts) => { seenCwd = opts.cwd; return 'https://github.com/o/r.git'; };
      localRepoSlug({ cwd: '/some/checkout', exec });
      expect(seenCwd).toBe('/some/checkout');
    });
  });
});
