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
  DEFAULT_ADMISSION_CAP, DEFAULT_TIMEOUT_MS, DEFAULT_ADMISSION_CEILING_MS, ADMISSION_SWITCH_ENV,
  ADMISSION_LEASE_MINUTES, resolveCap, resolveTimeoutMs, resolveCeilingMs, isAdmissionOff, slotPath,
  tryAcquireSlot, releaseOwnedSlot, heldSlots, probeSlotHolderLiveness,
  markWaiting, clearWaiting, listWaiting, partitionWaiting, pruneStaleWaiting, WAITING_STALE_GRACE_MS,
  acquireSlotBlocking, admissionStatus,
  runUnderAdmission, shellQuoteWord,
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

describe('resolveCeilingMs — the xhlriy2 hard give-up ceiling, env override, clamped sane', () => {
  it('defaults to 120 minutes when unset', () => {
    expect(resolveCeilingMs({})).toBe(DEFAULT_ADMISSION_CEILING_MS);
    expect(DEFAULT_ADMISSION_CEILING_MS).toBe(120 * 60_000);
  });
  it('reads WE_HEAVY_ADMISSION_CEILING_MS', () => expect(resolveCeilingMs({ WE_HEAVY_ADMISSION_CEILING_MS: '9000' })).toBe(9000));
  it('falls back on a non-finite or sub-1000ms value', () => {
    expect(resolveCeilingMs({ WE_HEAVY_ADMISSION_CEILING_MS: 'nope' })).toBe(DEFAULT_ADMISSION_CEILING_MS);
    expect(resolveCeilingMs({ WE_HEAVY_ADMISSION_CEILING_MS: '0' })).toBe(DEFAULT_ADMISSION_CEILING_MS);
  });
});

describe('isAdmissionOff — the WE_HEAVY_ADMISSION=off escape hatch', () => {
  it('is off for off/0/false/no, case-insensitively', () => {
    for (const v of ['off', 'OFF', '0', 'false', 'FALSE', 'no', 'No']) {
      expect(isAdmissionOff({ [ADMISSION_SWITCH_ENV]: v })).toBe(true);
    }
  });
  it('is on (not off) when unset or set to anything else', () => {
    expect(isAdmissionOff({})).toBe(false);
    expect(isAdmissionOff({ [ADMISSION_SWITCH_ENV]: 'on' })).toBe(false);
    expect(isAdmissionOff({ [ADMISSION_SWITCH_ENV]: '1' })).toBe(false);
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

  describe('#3383 live incident — slot reentrancy is keyed by REAL PROCESS IDENTITY, not the owner string alone', () => {
    // `owner` here is a LANE PATH (matches verify-lane.mjs's real call site: `owner: REPO`) — deliberately the
    // SAME string for two genuinely different real processes verifying the same lane back-to-back (a conveyor
    // auto-verify racing a manual re-verify, the confirmed live incident). `process.ppid` stands in for the
    // second process's pid — a real, distinct, verifiably-alive pid (the same trick this file's own
    // `probeSlotHolderLiveness` tests already use), so the liveness probe genuinely reports 'alive', not
    // 'dead' — proving this is NOT just the already-covered dead-pid-reclaim path.
    const SAME_LANE_PATH = '/Users/x/workspace/.lanes/web-everything/lane-34';

    it('omitting pid records the real process identity, including on same-owner re-acquisition', () => {
      const cap = 2;
      const first = tryAcquireSlot({ lockRoot, cap, owner: SAME_LANE_PATH, nowMs: T0, nowIso: iso(T0) });
      expect(first.ok).toBe(true);
      expect(heldSlots({ lockRoot, cap })[0].pid).toBe(process.pid);
      const again = tryAcquireSlot({ lockRoot, cap, owner: SAME_LANE_PATH, nowMs: T0 + 1000, nowIso: iso(T0 + 1000) });
      expect(again.ok).toBe(true);
      expect(again.slot).toBe(first.slot); // both omitted-pid calls belong to THIS real process
      const held = heldSlots({ lockRoot, cap });
      expect(held).toHaveLength(1);
      expect(held[0].pid).toBe(process.pid);
    });

    it('BEFORE this fix, two different alive processes under the same owner string would have shared one slot — now the second genuinely different process takes a real SECOND slot', () => {
      const cap = 2;
      const a = tryAcquireSlot({ lockRoot, cap, owner: SAME_LANE_PATH, nowMs: T0, nowIso: iso(T0), pid: process.pid });
      const b = tryAcquireSlot({ lockRoot, cap, owner: SAME_LANE_PATH, nowMs: T0 + 1000, nowIso: iso(T0 + 1000), pid: process.ppid });
      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
      expect(b.slot).not.toBe(a.slot); // a REAL second slot, never the "already mine" fast path
      expect(heldSlots({ lockRoot, cap })).toHaveLength(2); // status now correctly counts BOTH real holders
    });

    it('a genuinely different, still-alive process under the same owner string is BLOCKED (not reclaimed) once the cap is exhausted', () => {
      const cap = 1;
      tryAcquireSlot({ lockRoot, cap, owner: SAME_LANE_PATH, nowMs: T0, nowIso: iso(T0), pid: process.pid });
      const soonAfter = T0 + 1000; // well within the lease — must be BLOCKED, not fast-pathed or reclaimed
      const r = tryAcquireSlot({ lockRoot, cap, owner: SAME_LANE_PATH, nowMs: soonAfter, nowIso: iso(soonAfter), pid: process.ppid });
      expect(r.ok).toBe(false);
      expect(heldSlots({ lockRoot, cap })).toHaveLength(1);
    });

    it('the SAME process re-acquiring its own already-held slot under this owner string still fast-paths as "own" (heartbeat refresh) — the legitimate case this fix must not break', () => {
      const cap = 1;
      const first = tryAcquireSlot({ lockRoot, cap, owner: SAME_LANE_PATH, nowMs: T0, nowIso: iso(T0), pid: process.pid });
      const again = tryAcquireSlot({ lockRoot, cap, owner: SAME_LANE_PATH, nowMs: T0 + 1000, nowIso: iso(T0 + 1000), pid: process.pid });
      expect(again.ok).toBe(true);
      expect(again.slot).toBe(first.slot);
      expect(heldSlots({ lockRoot, cap })).toHaveLength(1); // still just one real holder
    });

    it('a same-owner-string holder that is provably DEAD is still reclaimed immediately (the PID fast path survives this fix)', () => {
      const cap = 1;
      const deadPid = 999999; // kill(pid,0) throws ESRCH — cannot exist
      tryAcquireSlot({ lockRoot, cap, owner: SAME_LANE_PATH, nowMs: T0, nowIso: iso(T0), pid: deadPid });
      const soonAfter = T0 + 1000;
      const r = tryAcquireSlot({ lockRoot, cap, owner: SAME_LANE_PATH, nowMs: soonAfter, nowIso: iso(soonAfter), pid: process.pid });
      expect(r.ok).toBe(true);
      expect(heldSlots({ lockRoot, cap })[0].pid).toBe(process.pid);
    });

    it('releaseOwnedSlot releases the CALLING process\'s own slot, never a sibling process\'s slot held under the same owner string', () => {
      const cap = 2;
      const a = tryAcquireSlot({ lockRoot, cap, owner: SAME_LANE_PATH, nowMs: T0, nowIso: iso(T0), pid: process.pid });
      const b = tryAcquireSlot({ lockRoot, cap, owner: SAME_LANE_PATH, nowMs: T0 + 1000, nowIso: iso(T0 + 1000), pid: process.ppid });
      // Process A releases (as itself) — must free ITS OWN slot, not B's.
      const rel = releaseOwnedSlot({ lockRoot, cap, owner: SAME_LANE_PATH, pid: process.pid });
      expect(rel).toEqual({ released: true, slot: a.slot });
      const held = heldSlots({ lockRoot, cap });
      expect(held).toHaveLength(1);
      expect(held[0].pid).toBe(process.ppid); // B's slot is untouched
      void b;
    });

    it('releaseOwnedSlot never grabs a DIFFERENT real pid\'s slot as a fallback — a pid that matches nothing releases nothing', () => {
      const cap = 1;
      tryAcquireSlot({ lockRoot, cap, owner: SAME_LANE_PATH, nowMs: T0, nowIso: iso(T0), pid: process.ppid }); // B's real slot
      // A THIRD, different real pid (our own) tries to release "its" slot — it holds none; must be a no-op,
      // never mistakenly free B's still-live slot.
      const rel = releaseOwnedSlot({ lockRoot, cap, owner: SAME_LANE_PATH, pid: process.pid });
      expect(rel).toEqual({ released: false, slot: null });
      expect(heldSlots({ lockRoot, cap })).toHaveLength(1); // B's slot is untouched
    });

    it('releaseOwnedSlot with pid:null (the CLI\'s manual/operator escape hatch) keeps the old owner-only match — releases the FIRST owner-matching slot regardless of pid', () => {
      const cap = 2;
      tryAcquireSlot({ lockRoot, cap, owner: SAME_LANE_PATH, nowMs: T0, nowIso: iso(T0), pid: process.pid });
      tryAcquireSlot({ lockRoot, cap, owner: SAME_LANE_PATH, nowMs: T0 + 1000, nowIso: iso(T0 + 1000), pid: process.ppid });
      const rel = releaseOwnedSlot({ lockRoot, cap, owner: SAME_LANE_PATH, pid: null });
      expect(rel.released).toBe(true); // some owner-matching slot was freed — the deliberate loose fallback
      expect(heldSlots({ lockRoot, cap })).toHaveLength(1);
    });
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

describe('acquireSlotBlocking — polls until free, marks/clears waiting, FAILS OPEN only at the hard ceiling (xhlriy2)', () => {
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

  it('records the wait on the won slot (requestedAt, acquiredAt, waitedMs) so a reader never has to infer it', async () => {
    tryAcquireSlot({ lockRoot, cap: 1, owner: 'HOLDER', nowMs: T0, nowIso: iso(T0) });
    let clock = T0;
    const sleep = async (ms) => { clock += ms; releaseOwnedSlot({ lockRoot, cap: 1, owner: 'HOLDER' }); };
    const r = await acquireSlotBlocking({ lockRoot, cap: 1, owner: 'W', pollMs: 3000, now: () => clock, sleep });
    expect(r.ok).toBe(true);
    const [held] = heldSlots({ lockRoot, cap: 1 });
    expect(held.meta).toEqual({ requestedAt: iso(T0), acquiredAt: iso(T0 + 3000), waitedMs: 3000 });
  });

  it('records a zero wait on a slot won at the first try', async () => {
    await acquireSlotBlocking({ lockRoot, cap: 1, owner: 'A', now: () => T0, sleep: async () => {} });
    expect(heldSlots({ lockRoot, cap: 1 })[0].meta).toEqual({ requestedAt: iso(T0), acquiredAt: iso(T0), waitedMs: 0 });
  });

  it('keeps polling PAST the old 20-minute DEFAULT_TIMEOUT_MS mark while the holder is still alive — the exact xhlriy2 fix', async () => {
    // 'HOLDER' is recorded under THIS test process's own pid (tryAcquireSlot's pid default), so the waiter's
    // liveness probe against it reports 'unknown' (never provably dead) — it must never be reclaimed by time
    // alone, and the old code's 20-minute elapsed-time give-up must no longer fire here.
    tryAcquireSlot({ lockRoot, cap: 1, owner: 'HOLDER', nowMs: T0, nowIso: iso(T0) });
    let clock = T0;
    const r = await acquireSlotBlocking({
      lockRoot, cap: 1, owner: 'B', pollMs: 60_000, ceilingMs: 40 * 60_000, // ceiling well past the old timeout
      now: () => clock, sleep: async (ms) => { clock += ms; },
    });
    // Never acquires (the holder never frees or dies) — but must have polled well past DEFAULT_TIMEOUT_MS
    // (20 min) before finally giving up at the 40-minute ceiling, proving it did NOT give up early.
    expect(r).toMatchObject({ ok: false, slot: null, timedOut: true, ceilingHit: true });
    expect(r.waitedMs).toBeGreaterThanOrEqual(40 * 60_000);
    expect(r.waitedMs).toBeGreaterThan(DEFAULT_TIMEOUT_MS);
    expect(listWaiting(lockRoot)).toHaveLength(0); // marker cleared even on give-up (the `finally`)
  });

  it('gives up and reports timedOut/ceilingHit only once the hard ceiling elapses — fails OPEN, never throws, with a loud warning', async () => {
    tryAcquireSlot({ lockRoot, cap: 1, owner: 'HOLDER', nowMs: T0, nowIso: iso(T0) });
    let clock = T0;
    const logs = [];
    const r = await acquireSlotBlocking({
      lockRoot, cap: 1, owner: 'B', pollMs: 1000, ceilingMs: 3000, log: (m) => logs.push(m),
      now: () => clock, sleep: async (ms) => { clock += ms; },
    });
    expect(r).toMatchObject({ ok: false, slot: null, timedOut: true, ceilingHit: true });
    expect(listWaiting(lockRoot)).toHaveLength(0); // marker cleared even on give-up (the `finally`)
    expect(logs.some((m) => /HARD CEILING/.test(m) && /proceeding unslotted/.test(m))).toBe(true);
  });

  it('logs a periodic "still waiting" line at stillWaitingLogMs cadence while blocked, well before the ceiling', async () => {
    tryAcquireSlot({ lockRoot, cap: 1, owner: 'HOLDER', nowMs: T0, nowIso: iso(T0) });
    let clock = T0;
    let polls = 0;
    const sleep = async (ms) => { clock += ms; polls += 1; if (polls === 5) releaseOwnedSlot({ lockRoot, cap: 1, owner: 'HOLDER' }); };
    const logs = [];
    const r = await acquireSlotBlocking({
      lockRoot, cap: 1, owner: 'B', pollMs: 1000, stillWaitingLogMs: 3000, ceilingMs: 60_000,
      log: (m) => logs.push(m), now: () => clock, sleep,
    });
    expect(r.ok).toBe(true);
    expect(logs.some((m) => /still waiting/.test(m))).toBe(true);
    expect(logs.some((m) => /HARD CEILING/.test(m))).toBe(false); // never hit the ceiling
  });

  it('a provably-dead holder is reclaimed immediately (a REAL slot, not "proceeding unslotted") — the mechanism the ceiling never needs to engage for a dead holder', async () => {
    const deadPid = 999999; // kill(pid,0) throws ESRCH — cannot exist
    tryAcquireSlot({ lockRoot, cap: 1, owner: 'HOLDER', nowMs: T0, nowIso: iso(T0), pid: deadPid });
    let clock = T0;
    const r = await acquireSlotBlocking({
      lockRoot, cap: 1, owner: 'B', pollMs: 1000, ceilingMs: 60_000,
      now: () => clock, sleep: async (ms) => { clock += ms; },
    });
    expect(r).toMatchObject({ ok: true }); // a REAL slot, reclaimed — never "unslotted"
    expect(heldSlots({ lockRoot, cap: 1 })[0].owner).toBe('B');
  });

  it('WE_HEAVY_ADMISSION=off is a pure pass-through — returns unslotted immediately, never touches the lock root or a waiting marker', async () => {
    tryAcquireSlot({ lockRoot, cap: 1, owner: 'HOLDER', nowMs: T0, nowIso: iso(T0) });
    const sleep = async () => { throw new Error('must never poll/sleep when disabled'); };
    const r = await acquireSlotBlocking({
      lockRoot, cap: 1, owner: 'B', now: () => T0, sleep, env: { [ADMISSION_SWITCH_ENV]: 'off' },
    });
    expect(r).toEqual({ ok: false, slot: null, timedOut: false, disabled: true, waitedMs: 0 });
    expect(listWaiting(lockRoot)).toHaveLength(0); // never marked waiting
  });
});

describe('admissionStatus — the shape tick-core.mjs reads', () => {
  it('reports cap, held/free counts, and live waiting entries', () => {
    tryAcquireSlot({ lockRoot, cap: 2, owner: 'A', nowMs: T0, nowIso: iso(T0) });
    markWaiting({ lockRoot, owner: 'B', lane: '5', nowIso: iso(T0) });
    const s = admissionStatus({ lockRoot, cap: 2, nowMs: T0 + 1000 });
    expect(s).toMatchObject({ cap: 2, heldCount: 1, freeCount: 1, staleWaiting: [] });
    expect(s.held).toHaveLength(1);
    expect(s.waiting).toHaveLength(1);
    expect(s.waiting[0]).toMatchObject({ owner: 'B', lane: '5' });
  });
});

describe('shellQuoteWord — round-trips an already-split argv word through /bin/sh -c', () => {
  it('leaves a plain word untouched', () => expect(shellQuoteWord('check:standards')).toBe('check:standards'));
  it('single-quotes a word containing whitespace', () => expect(shellQuoteWord('a b')).toBe(`'a b'`));
  it('escapes an embedded single quote the POSIX way', () => expect(shellQuoteWord(`it's`)).toBe(`'it'\\''s'`));
});

describe('runUnderAdmission — acquire → exec → release, the #3621 container-hook seam', () => {
  it('acquires a slot, runs the injected exec, releases on success', async () => {
    const calls = [];
    const exec = (cmd, o) => calls.push({ cmd, cwd: o.cwd });
    const r = await runUnderAdmission({ lockRoot, cap: 2, owner: 'A', command: 'echo hi', cwd: '/repo', exec, now: () => T0, sleep: async () => {} });
    expect(r.exitCode).toBe(0);
    expect(r.admission.ok).toBe(true);
    expect(calls).toEqual([{ cmd: 'echo hi', cwd: '/repo' }]);
    expect(heldSlots({ lockRoot, cap: 2 })).toHaveLength(0); // released
  });

  it('maps a thrown exec error status to the returned exitCode, and still releases the slot', async () => {
    const exec = () => { const e = new Error('boom'); e.status = 7; throw e; };
    const r = await runUnderAdmission({ lockRoot, cap: 1, owner: 'A', command: 'false', exec, now: () => T0, sleep: async () => {} });
    expect(r.exitCode).toBe(7);
    expect(heldSlots({ lockRoot, cap: 1 })).toHaveLength(0);
  });

  it('defaults a thrown error with no numeric status to exitCode 1', async () => {
    const exec = () => { throw new Error('no status field'); };
    const r = await runUnderAdmission({ lockRoot, cap: 1, owner: 'A', command: 'false', exec, now: () => T0, sleep: async () => {} });
    expect(r.exitCode).toBe(1);
  });

  it('the exec seam is swappable — the #3621 container POC injects container-exec.mjs#execContainerized here instead of execSync, unchanged acquire/release sequencing either way', async () => {
    const seen = [];
    const fakeContainerExec = (cmd, o) => seen.push(`container:${cmd}`);
    const r = await runUnderAdmission({ lockRoot, cap: 1, owner: 'A', command: 'node scripts/check-standards.mjs', exec: fakeContainerExec, now: () => T0, sleep: async () => {} });
    expect(r.exitCode).toBe(0);
    expect(seen).toEqual(['container:node scripts/check-standards.mjs']);
  });

  it('still fails open on a queuing timeout — runs unslotted rather than refusing', async () => {
    tryAcquireSlot({ lockRoot, cap: 1, owner: 'HOLDER', nowMs: T0, nowIso: iso(T0) });
    let clock = T0;
    const calls = [];
    const r = await runUnderAdmission({
      lockRoot, cap: 1, owner: 'B', command: 'echo hi', ceilingMs: 3000,
      exec: (cmd) => calls.push(cmd), now: () => clock, sleep: async (ms) => { clock += ms; },
    });
    expect(r.admission.timedOut).toBe(true);
    expect(calls).toEqual(['echo hi']); // ran anyway
  });
});

describe('runUnderAdmission — the general-purpose wrapper (#3383): acquire → exec → release, mirroring verify-lane.mjs\'s own call site', () => {
  it('acquires a slot, runs the command, and releases the slot on success', async () => {
    const calls = [];
    const exec = (cmd, opts) => { calls.push({ cmd, opts }); };
    const r = await runUnderAdmission({
      lockRoot, cap: 1, owner: 'A', command: 'echo hi', cwd: '/some/cwd', exec, log: () => {},
      now: () => T0, sleep: async () => {},
    });
    expect(r).toEqual({ exitCode: 0, admission: { ok: true, slot: 0, timedOut: false, waitedMs: 0 } });
    expect(calls).toEqual([{ cmd: 'echo hi', opts: { cwd: '/some/cwd', stdio: 'inherit' } }]);
    expect(heldSlots({ lockRoot, cap: 1 })).toHaveLength(0); // released, not left held
  });

  it('propagates a failing command\'s exit code and still releases the slot (the finally)', async () => {
    const exec = () => { const e = new Error('boom'); e.status = 7; throw e; };
    const r = await runUnderAdmission({ lockRoot, cap: 1, owner: 'A', command: 'false', exec, log: () => {}, now: () => T0, sleep: async () => {} });
    expect(r.exitCode).toBe(7);
    expect(heldSlots({ lockRoot, cap: 1 })).toHaveLength(0);
  });

  it('falls back to exit code 1 when the thrown error carries no numeric status', async () => {
    const exec = () => { throw new Error('no status field'); };
    const r = await runUnderAdmission({ lockRoot, cap: 1, owner: 'A', command: 'false', exec, log: () => {}, now: () => T0, sleep: async () => {} });
    expect(r.exitCode).toBe(1);
  });

  it('waits for a held slot, runs once free, and logs the wait — same acquire/log shape as verify-lane.mjs', async () => {
    tryAcquireSlot({ lockRoot, cap: 1, owner: 'HOLDER', nowMs: T0, nowIso: iso(T0) });
    let clock = T0;
    let polls = 0;
    const sleep = async (ms) => { clock += ms; polls += 1; if (polls === 1) releaseOwnedSlot({ lockRoot, cap: 1, owner: 'HOLDER' }); };
    const logs = [];
    const exec = () => {};
    const r = await runUnderAdmission({
      lockRoot, cap: 1, owner: 'B', command: 'echo hi', exec, log: (m) => logs.push(m),
      now: () => clock, sleep, pollMs: 100,
    });
    expect(r.exitCode).toBe(0);
    expect(r.admission.waitedMs).toBeGreaterThan(0);
    expect(logs.some((m) => /acquired slot-0 after waiting/.test(m))).toBe(true);
  });

  it('FAILS OPEN on a queuing timeout — still runs the command unslotted, never refuses to run it', async () => {
    tryAcquireSlot({ lockRoot, cap: 1, owner: 'HOLDER', nowMs: T0, nowIso: iso(T0) });
    let clock = T0;
    const calls = [];
    const exec = (cmd) => { calls.push(cmd); };
    const logs = [];
    const r = await runUnderAdmission({
      lockRoot, cap: 1, owner: 'B', command: 'echo hi', exec, log: (m) => logs.push(m),
      now: () => clock, sleep: async (ms) => { clock += ms; }, ceilingMs: 3000, pollMs: 1000,
    });
    expect(r.admission).toMatchObject({ ok: false, timedOut: true });
    expect(calls).toEqual(['echo hi']); // ran anyway, unslotted
    expect(logs.some((m) => /timed out.*proceeding unslotted/.test(m))).toBe(true);
    expect(heldSlots({ lockRoot, cap: 1 })).toHaveLength(1); // HOLDER's own slot — nothing of ours to release
  });
});

describe('shellQuoteWord — re-quoting the `run` CLI\'s post-`--` argv tail into one shell command line', () => {
  it('leaves a plain word untouched', () => {
    expect(shellQuoteWord('npx')).toBe('npx');
    expect(shellQuoteWord('--coverage')).toBe('--coverage');
    expect(shellQuoteWord('path/to/file.test.ts')).toBe('path/to/file.test.ts');
  });

  it('single-quotes a word containing whitespace, so it round-trips as ONE argument', () => {
    expect(shellQuoteWord('-t "some test name"')).toBe(`'-t "some test name"'`);
    expect(shellQuoteWord('a b')).toBe(`'a b'`);
  });

  it('escapes an embedded single quote the POSIX way', () => {
    expect(shellQuoteWord("it's")).toBe(`'it'\\''s'`);
  });
});

describe('host-sampler fix — heavy.admission.waiting counted ghost markers, not waiters', () => {
  const dead = () => 'dead';
  const alive = () => 'alive';
  // xhlriy2: a LIVE marker can now legitimately be waiting up to DEFAULT_ADMISSION_CEILING_MS (120 minutes,
  // not the old 20-minute DEFAULT_TIMEOUT_MS) before it gives up and clears its own marker — so "old enough to
  // be a ghost" must be measured against the ceiling now, or a genuinely still-waiting long queue entry would
  // be misclassified as stale and pruned out from under it.
  const OLD = iso(T0 - DEFAULT_ADMISSION_CEILING_MS - WAITING_STALE_GRACE_MS - 1000);

  it('REGRESSION: markers left by dead/aged-out waiters no longer read as queue depth while a slot is free', () => {
    // The live host: 1 of 2 slots held, FOUR ghost markers (2026-09-04 / 2026-09-14) → the old status said waiting=4.
    tryAcquireSlot({ lockRoot, cap: 2, owner: 'HOLDER', nowMs: T0, nowIso: iso(T0) });
    markWaiting({ lockRoot, owner: 'ghost-old-1', lane: '1', pid: null, nowIso: OLD });
    markWaiting({ lockRoot, owner: 'ghost-old-2', lane: '2', pid: null, nowIso: OLD });
    markWaiting({ lockRoot, owner: 'ghost-dead-3', lane: '3', pid: 999999, nowIso: iso(T0) });
    markWaiting({ lockRoot, owner: 'ghost-dead-4', lane: '4', pid: 999998, nowIso: iso(T0) });
    const s = admissionStatus({ lockRoot, cap: 2, nowMs: T0 + 5000, pidLiveness: dead });
    expect(s.waiting).toEqual([]);
    expect(s.staleWaiting).toHaveLength(4);
    expect(s).toMatchObject({ heldCount: 1, freeCount: 1 });
  });

  it('a genuinely live, fresh waiter still counts', () => {
    markWaiting({ lockRoot, owner: 'LIVE', lane: '9', pid: 4242, nowIso: iso(T0) });
    const s = admissionStatus({ lockRoot, cap: 2, nowMs: T0 + 5000, pidLiveness: alive });
    expect(s.waiting.map((w) => w.owner)).toEqual(['LIVE']);
    expect(s.staleWaiting).toEqual([]);
  });

  it('markWaiting records the waiter pid; partitionWaiting is age-only for a pid-less marker', () => {
    markWaiting({ lockRoot, owner: 'P', nowIso: iso(T0), pid: 777 });
    expect(listWaiting(lockRoot)[0].pid).toBe(777);
    const fresh = { owner: 'a', requestedAt: iso(T0) };
    const aged = { owner: 'b', requestedAt: OLD };
    const { live, stale } = partitionWaiting([fresh, aged], { nowMs: T0 + 1000, pidLiveness: dead });
    expect(live).toEqual([fresh]);
    expect(stale).toEqual([aged]);
  });

  it('an aged-out marker whose pid is unprovable is still stale, a fresh unknown-pid marker is live', () => {
    const unknown = () => 'unknown';
    const { live, stale } = partitionWaiting(
      [{ owner: 'a', pid: 5, requestedAt: iso(T0) }, { owner: 'b', pid: 6, requestedAt: OLD }],
      { nowMs: T0 + 1000, pidLiveness: unknown },
    );
    expect(live.map((m) => m.owner)).toEqual(['a']);
    expect(stale.map((m) => m.owner)).toEqual(['b']);
  });

  it('pruneStaleWaiting deletes only provably-stale markers', () => {
    markWaiting({ lockRoot, owner: 'gone', pid: 31337, nowIso: iso(T0) });
    markWaiting({ lockRoot, owner: 'here', pid: 4242, nowIso: iso(T0) });
    const n = pruneStaleWaiting({ lockRoot, nowMs: T0 + 1000, pidLiveness: (pid) => (pid === 31337 ? 'dead' : 'alive') });
    expect(n).toBe(1);
    expect(listWaiting(lockRoot).map((w) => w.owner)).toEqual(['here']);
  });
});
