/**
 * @file scripts/readiness/__tests__/heavy-admission.test.mjs
 * @description Unit proof of the #3461 heavy-command admission-queue semaphore: slot acquisition/release built
 *   on `file-locks.mjs`'s existing atomic primitives, the observable waiting-intent markers, and the blocking
 *   wait primitive's fail-open timeout. Against a real temp lock root (mirrors `file-locks.test.mjs`'s own
 *   discipline of proving the atomic fs layer for real, not just its pure decision logic).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_ADMISSION_CAP, DEFAULT_TIMEOUT_MS, ADMISSION_LEASE_MINUTES, resolveCap, resolveTimeoutMs, slotPath,
  tryAcquireSlot, releaseOwnedSlot, heldSlots, probeSlotHolderLiveness,
  markWaiting, clearWaiting, listWaiting,
  acquireSlotBlocking, admissionStatus,
} from '../heavy-admission.mjs';

const T0 = Date.parse('2026-09-03T12:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();

let lockRoot;
beforeEach(() => { lockRoot = mkdtempSync(join(tmpdir(), 'heavy-admission-test-')); });
afterEach(() => { rmSync(lockRoot, { recursive: true, force: true }); });

describe('resolveCap — env override, clamped sane', () => {
  it('defaults when unset', () => expect(resolveCap({})).toBe(DEFAULT_ADMISSION_CAP));
  it('reads WE_HEAVY_ADMISSION_CAP', () => expect(resolveCap({ WE_HEAVY_ADMISSION_CAP: '5' })).toBe(5));
  it('falls back on a non-finite or sub-1 value', () => {
    expect(resolveCap({ WE_HEAVY_ADMISSION_CAP: 'nope' })).toBe(DEFAULT_ADMISSION_CAP);
    expect(resolveCap({ WE_HEAVY_ADMISSION_CAP: '0' })).toBe(DEFAULT_ADMISSION_CAP);
  });
});

describe('resolveTimeoutMs — env override, clamped sane (the doc/impl mismatch this fix closes)', () => {
  it('defaults when unset', () => expect(resolveTimeoutMs({})).toBe(DEFAULT_TIMEOUT_MS));
  it('reads WE_HEAVY_ADMISSION_TIMEOUT_MS', () => expect(resolveTimeoutMs({ WE_HEAVY_ADMISSION_TIMEOUT_MS: '5000' })).toBe(5000));
  it('falls back on a non-finite or sub-1000ms value', () => {
    expect(resolveTimeoutMs({ WE_HEAVY_ADMISSION_TIMEOUT_MS: 'nope' })).toBe(DEFAULT_TIMEOUT_MS);
    expect(resolveTimeoutMs({ WE_HEAVY_ADMISSION_TIMEOUT_MS: '0' })).toBe(DEFAULT_TIMEOUT_MS);
  });
});

describe('tryAcquireSlot / releaseOwnedSlot / heldSlots — cap independent slots, each an ordinary file-lock', () => {
  it('admits up to cap concurrent owners, then refuses a (cap+1)th', () => {
    const cap = 2;
    const a = tryAcquireSlot({ lockRoot, cap, owner: 'A', nowMs: T0, nowIso: iso(T0) });
    const b = tryAcquireSlot({ lockRoot, cap, owner: 'B', nowMs: T0, nowIso: iso(T0) });
    const c = tryAcquireSlot({ lockRoot, cap, owner: 'C', nowMs: T0, nowIso: iso(T0) });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(new Set([a.slot, b.slot]).size).toBe(2); // distinct slots
    expect(c.ok).toBe(false);
    expect(heldSlots({ lockRoot, cap })).toHaveLength(2);
  });

  it('release frees the slot for a new owner', () => {
    const cap = 1;
    const a = tryAcquireSlot({ lockRoot, cap, owner: 'A', nowMs: T0, nowIso: iso(T0) });
    expect(a.ok).toBe(true);
    expect(tryAcquireSlot({ lockRoot, cap, owner: 'B', nowMs: T0, nowIso: iso(T0) }).ok).toBe(false);
    releaseOwnedSlot({ lockRoot, cap, owner: 'A' });
    expect(heldSlots({ lockRoot, cap })).toHaveLength(0);
    expect(tryAcquireSlot({ lockRoot, cap, owner: 'B', nowMs: T0, nowIso: iso(T0) }).ok).toBe(true);
  });

  it('re-acquiring your own held slot is a no-op success (heartbeat refresh), not a second slot', () => {
    const cap = 1;
    tryAcquireSlot({ lockRoot, cap, owner: 'A', nowMs: T0, nowIso: iso(T0) });
    const again = tryAcquireSlot({ lockRoot, cap, owner: 'A', nowMs: T0 + 1000, nowIso: iso(T0 + 1000) });
    expect(again.ok).toBe(true);
    expect(heldSlots({ lockRoot, cap })).toHaveLength(1);
  });

  it('reclaims a slot whose lease has expired (stale-owner TTL floor, inherited from file-locks.mjs)', () => {
    const cap = 1;
    tryAcquireSlot({ lockRoot, cap, owner: 'A', nowMs: T0, nowIso: iso(T0) });
    const wayLater = T0 + (ADMISSION_LEASE_MINUTES + 5) * 60_000; // comfortably past the admission-specific lease
    const r = tryAcquireSlot({ lockRoot, cap, owner: 'B', nowMs: wayLater, nowIso: iso(wayLater) });
    expect(r.ok).toBe(true);
    expect(heldSlots({ lockRoot, cap })[0].owner).toBe('B');
  });

  it('does NOT reclaim a still-alive holder before its (deliberately long) lease expires — the fix for a false reclaim mid-gate', () => {
    const cap = 1;
    tryAcquireSlot({ lockRoot, cap, owner: 'A', nowMs: T0, nowIso: iso(T0) });
    // Past file-locks.mjs's general-purpose 15-minute default, but well inside ADMISSION_LEASE_MINUTES (60) —
    // a real test:unit + check:standards run can legitimately exceed 15 minutes; it must not be reclaimed.
    const midGate = T0 + 20 * 60_000;
    const r = tryAcquireSlot({ lockRoot, cap, owner: 'B', nowMs: midGate, nowIso: iso(midGate) });
    expect(r.ok).toBe(false);
    expect(heldSlots({ lockRoot, cap })[0].owner).toBe('A');
  });

  it('reclaims a provably-dead same-machine holder immediately via the PID fast path, ignoring the long TTL', () => {
    const cap = 1;
    // A pid that cannot exist (kill(pid,0) throws ESRCH) — simulates a crashed holder.
    const deadPid = 999999;
    tryAcquireSlot({ lockRoot, cap, owner: 'A', nowMs: T0, nowIso: iso(T0), pid: deadPid });
    const soonAfter = T0 + 1000; // well within the 60-minute lease — only the PID fast path can reclaim this
    const r = tryAcquireSlot({ lockRoot, cap, owner: 'B', nowMs: soonAfter, nowIso: iso(soonAfter) });
    expect(r.ok).toBe(true);
    expect(heldSlots({ lockRoot, cap })[0].owner).toBe('B');
  });

  it('does NOT fast-path-reclaim a slot held by a live pid, even well before the TTL', () => {
    const cap = 1;
    // process.ppid (this test's parent process) is a real, distinct, verifiably-alive pid — probing it must
    // report 'alive', not 'dead', and must NOT skip via the self-pid guard the way process.pid would.
    tryAcquireSlot({ lockRoot, cap, owner: 'A', nowMs: T0, nowIso: iso(T0), pid: process.ppid });
    const soonAfter = T0 + 1000;
    const r = tryAcquireSlot({ lockRoot, cap, owner: 'B', nowMs: soonAfter, nowIso: iso(soonAfter) });
    expect(r.ok).toBe(false);
  });

  it('release is idempotent for an owner holding nothing', () => {
    expect(releaseOwnedSlot({ lockRoot, cap: 2, owner: 'nobody' })).toEqual({ released: false, slot: null });
  });

  it('slotPath is stable and distinct per index', () => {
    expect(slotPath(0)).toBe('slot-0');
    expect(slotPath(1)).not.toBe(slotPath(0));
  });
});

describe('probeSlotHolderLiveness — the PID fast path in isolation', () => {
  it('reports dead for a pid that cannot exist', () => {
    expect(probeSlotHolderLiveness(999999, process.pid)).toBe('dead');
  });
  it('reports alive for a real, distinct, live pid', () => {
    expect(probeSlotHolderLiveness(process.ppid, process.pid)).toBe('alive');
  });
  it('reports unknown (never accelerates) for a null pid, a non-positive pid, or the caller\'s own pid', () => {
    expect(probeSlotHolderLiveness(null, process.pid)).toBe('unknown');
    expect(probeSlotHolderLiveness(0, process.pid)).toBe('unknown');
    expect(probeSlotHolderLiveness(-1, process.pid)).toBe('unknown');
    expect(probeSlotHolderLiveness(process.pid, process.pid)).toBe('unknown');
  });
});

describe('waiting-intent markers — the observable queue', () => {
  it('markWaiting then listWaiting round-trips; clearWaiting removes it', () => {
    markWaiting({ lockRoot, owner: 'A', lane: '4', num: 99, nowIso: iso(T0) });
    const w = listWaiting(lockRoot);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ owner: 'A', lane: '4', num: 99 });
    clearWaiting({ lockRoot, owner: 'A' });
    expect(listWaiting(lockRoot)).toHaveLength(0);
  });

  it('listWaiting returns empty (never throws) when the waiting dir does not exist yet', () => {
    expect(listWaiting(join(lockRoot, 'never-created'))).toEqual([]);
  });

  it('an owner string with path-unsafe characters (a lane clone path) still yields a legible, safe marker', () => {
    markWaiting({ lockRoot, owner: '/Users/x/workspace/.lanes/web-everything/lane-27', lane: '27', nowIso: iso(T0) });
    const w = listWaiting(lockRoot);
    expect(w).toHaveLength(1);
    expect(w[0].owner).toContain('lane-27');
  });
});

describe('acquireSlotBlocking — polls until free, marks/clears waiting, FAILS OPEN on timeout', () => {
  it('acquires immediately with zero wait when a slot is free', async () => {
    const r = await acquireSlotBlocking({ lockRoot, cap: 1, owner: 'A', now: () => T0, sleep: async () => {} });
    expect(r).toEqual({ ok: true, slot: 0, timedOut: false, waitedMs: 0 });
    expect(listWaiting(lockRoot)).toHaveLength(0); // never marked waiting — it never needed to
  });

  it('marks waiting while blocked, clears it once a slot frees, and returns the wait duration', async () => {
    tryAcquireSlot({ lockRoot, cap: 1, owner: 'HOLDER', nowMs: T0, nowIso: iso(T0) });
    let clock = T0;
    const now = () => clock;
    let polls = 0;
    const sleep = async (ms) => {
      clock += ms;
      polls += 1;
      if (polls === 2) releaseOwnedSlot({ lockRoot, cap: 1, owner: 'HOLDER' }); // free it on the 2nd poll
    };
    const r = await acquireSlotBlocking({ lockRoot, cap: 1, owner: 'B', lane: '9', pollMs: 1000, now, sleep });
    expect(r.ok).toBe(true);
    expect(r.waitedMs).toBeGreaterThan(0);
    expect(listWaiting(lockRoot)).toHaveLength(0); // cleared on success
  });

  it('gives up and reports timedOut when no slot frees before timeoutMs — fails OPEN, never throws', async () => {
    tryAcquireSlot({ lockRoot, cap: 1, owner: 'HOLDER', nowMs: T0, nowIso: iso(T0) });
    let clock = T0;
    const r = await acquireSlotBlocking({
      lockRoot, cap: 1, owner: 'B', pollMs: 1000, timeoutMs: 3000,
      now: () => clock, sleep: async (ms) => { clock += ms; },
    });
    expect(r).toMatchObject({ ok: false, slot: null, timedOut: true });
    expect(listWaiting(lockRoot)).toHaveLength(0); // marker cleared even on give-up (the `finally`)
  });
});

describe('admissionStatus — the shape tick-core.mjs reads', () => {
  it('reports cap, held/free counts, and live waiting entries', () => {
    tryAcquireSlot({ lockRoot, cap: 2, owner: 'A', nowMs: T0, nowIso: iso(T0) });
    markWaiting({ lockRoot, owner: 'B', lane: '5', nowIso: iso(T0) });
    const s = admissionStatus({ lockRoot, cap: 2 });
    expect(s).toMatchObject({ cap: 2, heldCount: 1, freeCount: 1 });
    expect(s.held).toHaveLength(1);
    expect(s.waiting).toHaveLength(1);
    expect(s.waiting[0]).toMatchObject({ owner: 'B', lane: '5' });
  });
});
