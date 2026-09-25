/**
 * @file scripts/readiness/__tests__/heavy-admission.test.mjs
 * @description Unit proof of the #3461 heavy-command admission-queue semaphore: slot acquisition/release built
 *   on `file-locks.mjs`'s existing atomic primitives, the observable waiting-intent markers, and the blocking
 *   wait primitive's fail-open timeout. Against a real temp lock root (mirrors `file-locks.test.mjs`'s own
 *   discipline of proving the atomic fs layer for real, not just its pure decision logic).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, realpathSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync, execSync, spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  DEFAULT_ADMISSION_CAP, DEFAULT_TIMEOUT_MS, DEFAULT_ADMISSION_CEILING_MS, ADMISSION_SWITCH_ENV,
  ADMISSION_LEASE_MINUTES, resolveCap, resolveTimeoutMs, resolveCeilingMs, isAdmissionOff, slotPath,
  tryAcquireSlot, releaseOwnedSlot, heldSlots, probeSlotHolderLiveness,
  markWaiting, clearWaiting, listWaiting,
  acquireSlotBlocking, admissionStatus,
  runUnderAdmission, shellQuoteWord,
  WAITING_TTL_MINUTES, ADMISSION_HELD_ENV, classifyWaiter, reapStaleWaiters, reapHistory, waiterRepo,
  admissionBypassReason, poolRootOf, admittedArgv, admittedShellCommand, HEAVY_ADMISSION_CLI,
  DEFAULT_LOAD_ADMISSION_MAX_PER_CORE, LOAD_ADMISSION_MAX_PER_CORE_ENV, LOAD_ADMISSION_SWITCH_ENV,
  resolveLoadAdmissionMaxPerCore, isLoadAdmissionOff, loadAdmissionDecision, readLatestLoad, resolveLoadAdmission,
} from '../heavy-admission.mjs';
import { utcDayKey } from '../../operations/telemetry-summary-io.mjs';
import { readLockEntry } from '../file-locks.mjs';

const T0 = Date.parse('2026-09-03T12:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();

let lockRoot;
beforeEach(() => { lockRoot = mkdtempSync(join(tmpdir(), 'heavy-admission-test-')); });
afterEach(() => { rmSync(lockRoot, { recursive: true, force: true }); });

describe('CLI relative --repo', () => {
  it('resolves the repo before deriving the shared admission root and owner', () => {
    const repo = join(lockRoot, '.lanes', 'test-pool', 'lane-1');
    mkdirSync(repo, { recursive: true });
    const env = { ...process.env };
    delete env.LANE_POOL_ROOT;
    execFileSync(process.execPath, [
      resolve('scripts/readiness/heavy-admission.mjs'),
      'acquire', '--repo=.', '--cap=1', '--json',
    ], { cwd: repo, env, encoding: 'utf8' });
    const held = heldSlots({ lockRoot: join(lockRoot, '.lanes', '.admission', 'heavy'), cap: 1 });
    expect(held).toHaveLength(1);
    expect(held[0].owner).toBe(realpathSync(repo));
  });
});

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

  it('forwards its own computed selfPid — not the raw omitted pid parameter — into the stored lock entry (#3679)', () => {
    const cap = 1;
    tryAcquireSlot({ lockRoot, cap, owner: 'A', nowMs: T0, nowIso: iso(T0) }); // pid intentionally omitted
    const entry = readLockEntry(lockRoot, slotPath(0));
    expect(entry.pid).toBe(process.pid); // BUG forwarded the raw (defaulted-null) `pid` param, so entry.pid was `null`
  });

  it('release is idempotent for an owner holding nothing', () => {
    expect(releaseOwnedSlot({ lockRoot, cap: 2, owner: 'nobody' })).toEqual({ released: false, slot: null });
  });

  it('slotPath is stable and distinct per index', () => {
    expect(slotPath(0)).toBe('slot-0');
    expect(slotPath(1)).not.toBe(slotPath(0));
  });
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
    const s = admissionStatus({ lockRoot, cap: 2 });
    expect(s).toMatchObject({ cap: 2, heldCount: 1, freeCount: 1 });
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

// ── xaipsbs: every heavy command through the pool ─────────────────────────────────────────────────────────

/** A clean env for a real CLI child: no CI / off switch / held flag leaking in from the runner's own env. */
function cliEnv(poolRoot, extra = {}) {
  const env = { ...process.env, LANE_POOL_ROOT: poolRoot, ...extra };
  delete env.CI; delete env.WE_HEAVY_ADMISSION; delete env[ADMISSION_HELD_ENV];
  return env;
}
const CLI = resolve('scripts/readiness/heavy-admission.mjs');

describe('admissionBypassReason — when the wrapper is a pass-through', () => {
  it('queues by default', () => expect(admissionBypassReason({ env: {}, poolExists: true })).toBeNull());
  it('passes through when an outer wrapper holds the slot', () => expect(admissionBypassReason({ env: { [ADMISSION_HELD_ENV]: '1' } })).toBe('held'));
  it('passes through in CI', () => {
    expect(admissionBypassReason({ env: { CI: 'true' } })).toBe('ci');
    expect(admissionBypassReason({ env: { CI: '1' } })).toBe('ci');
    expect(admissionBypassReason({ env: { CI: 'false' }, poolExists: true })).toBeNull();
  });
  it('passes through with WE_HEAVY_ADMISSION=off', () => expect(admissionBypassReason({ env: { WE_HEAVY_ADMISSION: 'off' } })).toBe('off'));
  it('passes through when there is no pool directory', () => expect(admissionBypassReason({ env: {}, poolExists: false })).toBe('no-pool'));
  it('poolRootOf strips .admission/heavy', () => expect(poolRootOf('/w/.lanes/.admission/heavy')).toBe('/w/.lanes'));
});

describe('runUnderAdmission — re-entrancy flag and bypass', () => {
  it('runs the child with WE_HEAVY_ADMISSION_HELD=1 so a nested wrapper passes through', async () => {
    const seen = [];
    await runUnderAdmission({ lockRoot, cap: 1, owner: 'A', command: 'x', env: { FOO: 'bar' }, exec: (c, o) => seen.push(o.env), now: () => T0, sleep: async () => {} });
    expect(seen[0]).toMatchObject({ FOO: 'bar', [ADMISSION_HELD_ENV]: '1' });
  });
  it('a bypassed run takes no slot, creates no lock root, and keeps the exit code', async () => {
    const root = join(lockRoot, 'never');
    const r = await runUnderAdmission({ lockRoot: root, cap: 1, owner: 'A', command: 'x', bypass: 'no-pool', exec: () => { throw Object.assign(new Error('x'), { status: 4 }); } });
    expect(r.exitCode).toBe(4);
    expect(r.admission.bypassed).toBe('no-pool');
    expect(existsSync(root)).toBe(false);
  });
});

describe('the run wrapper as a real process (xaipsbs)', () => {
  it('a NESTED wrapper neither deadlocks nor takes a second slot (cap 1)', () => {
    const pool = join(lockRoot, '.lanes');
    mkdirSync(pool, { recursive: true });
    // outer run → inner run → status. With cap 1, a second acquire would wait on the outer's slot forever
    // (well, until the timeout, which is set far past the test's own limit).
    const out = execFileSync(process.execPath, [CLI, 'run', '--cap=1', '--', process.execPath, CLI, 'run', '--cap=1', '--', process.execPath, CLI, 'status', '--cap=1'], {
      cwd: lockRoot, env: cliEnv(pool, { WE_HEAVY_ADMISSION_TIMEOUT_MS: '600000' }), encoding: 'utf8', timeout: 30_000,
    });
    const status = JSON.parse(out.trim().split('\n').pop());
    expect(status.heldCount).toBe(1);             // only the OUTER wrapper holds a slot
    expect(status.held[0].owner).toMatch(/#\d+$/); // a per-process owner
    expect(heldSlots({ lockRoot: join(pool, '.admission', 'heavy'), cap: 1 })).toHaveLength(0); // released after
  });

  it('two wrappers from the SAME checkout are two owners: with cap 1 the second waits for the first', async () => {
    const pool = join(lockRoot, '.lanes');
    mkdirSync(pool, { recursive: true });
    const log = join(lockRoot, 'log.txt');
    writeFileSync(log, '');
    const body = `const fs=require('fs');fs.appendFileSync(${JSON.stringify(log)},'start '+Date.now()+'\\n');setTimeout(()=>fs.appendFileSync(${JSON.stringify(log)},'end '+Date.now()+'\\n'),1500)`;
    const runOne = () => new Promise((res) => {
      const c = spawn(process.execPath, [CLI, 'run', '--cap=1', '--', process.execPath, '-e', body], { cwd: lockRoot, env: cliEnv(pool), stdio: 'ignore' });
      c.on('exit', (code) => res(code));
    });
    const codes = await Promise.all([runOne(), runOne()]);
    expect(codes).toEqual([0, 0]);
    const ev = readFileSync(log, 'utf8').trim().split('\n').map((l) => l.split(' '));
    // never two `start`s without an `end` between them — the runs did not overlap
    expect(ev.map((e) => e[0])).toEqual(['start', 'end', 'start', 'end']);
  }, 30_000);

  it('CI=true: a pass-through that creates nothing', () => {
    const pool = join(lockRoot, 'no-such-pool');
    const out = execFileSync(process.execPath, [CLI, 'run', '--', 'echo', 'ran'], { cwd: lockRoot, env: { ...cliEnv(pool), CI: 'true' }, encoding: 'utf8' });
    expect(out.trim()).toBe('ran');
    expect(existsSync(pool)).toBe(false);
  });

  it('admittedArgv keeps the wrapped command\'s stdout and exit code (what the sync callers rely on)', () => {
    const pool = join(lockRoot, '.lanes');
    mkdirSync(pool, { recursive: true });
    const ok = admittedArgv(process.execPath, ['-e', 'process.stdout.write("hello")']);
    expect(ok.args.slice(0, 3)).toEqual([HEAVY_ADMISSION_CLI, 'run', '--']);
    expect(execFileSync(ok.file, ok.args, { cwd: lockRoot, env: cliEnv(pool), encoding: 'utf8' })).toBe('hello');
    const bad = admittedArgv(process.execPath, ['-e', 'process.exit(5)']);
    let status = null;
    try { execFileSync(bad.file, bad.args, { cwd: lockRoot, env: cliEnv(pool), stdio: 'ignore' }); } catch (e) { status = e.status; }
    expect(status).toBe(5);
  });

  it('admittedShellCommand keeps && semantics inside one slot', () => {
    const pool = join(lockRoot, '.lanes');
    mkdirSync(pool, { recursive: true });
    const out = execSync(admittedShellCommand('echo a && echo b'), { cwd: lockRoot, env: cliEnv(pool), encoding: 'utf8' });
    expect(out.trim().split('\n')).toEqual(['a', 'b']);
  });
});

describe('stale-waiter reap (xaipsbs)', () => {
  const TTL = WAITING_TTL_MINUTES * 60_000;
  const old = iso(T0 - TTL - 60_000);
  const opts = (over = {}) => ({ nowMs: T0, host: 'h', pidLiveness: () => 'unknown', readLease: () => null, ...over });

  it('never reaps a marker younger than the TTL, whatever the evidence', () => {
    expect(classifyWaiter({ owner: '/p/lane-1', requestedAt: iso(T0 - 1000), pid: 1, host: 'h' }, opts({ pidLiveness: () => 'dead' }))).toEqual({ reap: false, reason: 'fresh' });
  });
  it('reaps an old marker whose pid on this host is dead; keeps one whose pid is alive', () => {
    expect(classifyWaiter({ owner: 'x', requestedAt: old, pid: 7, host: 'h' }, opts({ pidLiveness: () => 'dead' })).reason).toBe('pid-dead');
    expect(classifyWaiter({ owner: 'x', requestedAt: old, pid: 7, host: 'h' }, opts({ pidLiveness: () => 'alive' })).reap).toBe(false);
  });
  it('ignores a pid recorded on another host and falls back to the lane lease', () => {
    expect(classifyWaiter({ owner: '/p/lane-2', requestedAt: old, pid: 7, host: 'other' }, opts({ pidLiveness: () => 'alive' })).reason).toBe('no-lease');
  });
  it('a legacy lane marker (no pid): no lease → reap; a lease taken after the wait began → reap; an older live lease → keep', () => {
    const m = { owner: '/p/lane-27', requestedAt: old };
    expect(classifyWaiter(m, opts()).reason).toBe('no-lease');
    expect(classifyWaiter(m, opts({ readLease: () => ({ acquiredAt: iso(T0 - 1000), ttlMinutes: 240 }) })).reason).toBe('lease-newer');
    expect(classifyWaiter(m, opts({ readLease: () => ({ acquiredAt: iso(T0 - TTL - 120_000), ttlMinutes: 240 }) }))).toEqual({ reap: false, reason: 'lease-live' });
    expect(classifyWaiter(m, opts({ readLease: () => ({ acquiredAt: iso(T0 - 10 * 3600_000), ttlMinutes: 240 }) })).reason).toBe('no-lease'); // stale lease
  });
  it('keeps an old non-lane marker with no pid — nothing proves its owner is gone', () => {
    expect(classifyWaiter({ owner: '/Users/x/webeverything', requestedAt: old }, opts())).toEqual({ reap: false, reason: 'owner-unknown' });
  });
  it('waiterRepo strips the per-process #pid suffix', () => {
    expect(waiterRepo({ owner: '/p/lane-3#123' })).toBe('/p/lane-3');
    expect(waiterRepo({ owner: 'x', repo: '/r' })).toBe('/r');
  });

  it('reapStaleWaiters previews without touching, --apply removes and logs, status reports both counts', () => {
    markWaiting({ lockRoot, owner: '/gone/lane-9', lane: '9', nowIso: old });
    markWaiting({ lockRoot, owner: 'fresh', nowIso: iso(T0) });
    const preview = reapStaleWaiters({ lockRoot, nowMs: T0, readLease: () => null });
    expect(preview.reaped.map((r) => r.owner)).toEqual(['/gone/lane-9']);
    expect(listWaiting(lockRoot)).toHaveLength(2);
    expect(admissionStatus({ lockRoot, cap: 1, nowMs: T0, readLease: () => null })).toMatchObject({ staleWaiting: 1, reaped: { count: 0 } });
    reapStaleWaiters({ lockRoot, nowMs: T0, readLease: () => null, apply: true });
    expect(listWaiting(lockRoot).map((w) => w.owner)).toEqual(['fresh']);
    expect(reapHistory(lockRoot)).toMatchObject({ count: 1, last: { owner: '/gone/lane-9', reason: 'no-lease' } });
    expect(admissionStatus({ lockRoot, cap: 1, nowMs: T0 })).toMatchObject({ staleWaiting: 0, reaped: { count: 1 } });
  });

  it('the next admission attempt reaps (real lease read: a lane path with no lease marker)', async () => {
    markWaiting({ lockRoot, owner: join(lockRoot, 'pool', 'lane-5'), lane: '5', nowIso: old });
    const r = await acquireSlotBlocking({ lockRoot, cap: 1, owner: 'B', now: () => T0, sleep: async () => {} });
    expect(r.ok).toBe(true);
    expect(listWaiting(lockRoot)).toHaveLength(0);
    expect(reapHistory(lockRoot).count).toBe(1);
  });

  it('a new waiting marker records pid, host and repo — the evidence the reap reads', async () => {
    tryAcquireSlot({ lockRoot, cap: 1, owner: 'HOLDER', nowMs: T0, nowIso: iso(T0) });
    let seen = null;
    await acquireSlotBlocking({ lockRoot, cap: 1, owner: 'W', repo: '/r', pollMs: 1000, ceilingMs: 2000, now: (() => { let c = T0; return () => (c += 500); })(), sleep: async () => { seen = listWaiting(lockRoot)[0]; } });
    expect(seen).toMatchObject({ owner: 'W', repo: '/r', pid: process.pid });
    expect(typeof seen.host).toBe('string');
  });

  it('the reap CLI previews by default and removes with --apply', () => {
    const pool = join(lockRoot, '.lanes');
    const root = join(pool, '.admission', 'heavy');
    mkdirSync(root, { recursive: true });
    markWaiting({ lockRoot: root, owner: join(pool, 'wp', 'lane-8'), lane: '8', nowIso: '2026-09-04T15:04:58.681Z' });
    const preview = execFileSync(process.execPath, [CLI, 'reap'], { cwd: lockRoot, env: cliEnv(pool), encoding: 'utf8' });
    expect(preview).toMatch(/would reap: .*lane-8/);
    expect(listWaiting(root)).toHaveLength(1);
    execFileSync(process.execPath, [CLI, 'reap', '--apply'], { cwd: lockRoot, env: cliEnv(pool), encoding: 'utf8' });
    expect(listWaiting(root)).toHaveLength(0);
    const status = JSON.parse(execFileSync(process.execPath, [CLI, 'status'], { cwd: lockRoot, env: cliEnv(pool), encoding: 'utf8' }));
    expect(status.reaped.count).toBe(1);
  });
});

// ── #4076: the load-admission gate — a SECOND, per-core admission axis for NEW dispatched sessions ──────────

describe('loadAdmissionDecision (pure)', () => {
  it('admits when load1/cores is at or below the threshold', () => {
    expect(loadAdmissionDecision({ load1: 6, cores: 12, maxPerCore: 1.5 })).toEqual({ held: false, load1: 6, cores: 12, perCore: 0.5, maxPerCore: 1.5 });
    expect(loadAdmissionDecision({ load1: 18, cores: 12, maxPerCore: 1.5 }).held).toBe(false); // exactly at the threshold — not OVER it
  });

  it('holds once load1/cores is STRICTLY above the threshold — the exact "admission is held above threshold, admitted when it drops" contract', () => {
    const held = loadAdmissionDecision({ load1: 18.01, cores: 12, maxPerCore: 1.5 });
    expect(held.held).toBe(true);
    expect(held.perCore).toBeCloseTo(1.5008, 3);
    // the SAME reading, dropped back to the threshold, is admitted again — nothing sticky about the decision.
    const admitted = loadAdmissionDecision({ load1: 18, cores: 12, maxPerCore: 1.5 });
    expect(admitted.held).toBe(false);
  });

  it('mirrors the #xupukxa incident ratio (34.95/12 ≈ 2.91) against the module default — well past it', () => {
    const d = loadAdmissionDecision({ load1: 34.95, cores: 12 });
    expect(d.maxPerCore).toBe(DEFAULT_LOAD_ADMISSION_MAX_PER_CORE);
    expect(d.held).toBe(true);
  });

  it('fails OPEN (admits) on a missing load1, missing cores, or non-positive cores — never a guess', () => {
    expect(loadAdmissionDecision({ load1: null, cores: 12 })).toMatchObject({ held: false, load1: null, cores: 12, reason: 'no-sample' });
    expect(loadAdmissionDecision({ load1: 20, cores: null })).toMatchObject({ held: false, load1: 20, cores: null, reason: 'no-sample' });
    expect(loadAdmissionDecision({ load1: 20, cores: 0 })).toMatchObject({ held: false, reason: 'no-sample' });
    expect(loadAdmissionDecision({})).toMatchObject({ held: false, load1: null, cores: null, perCore: null, reason: 'no-sample' });
  });

  it('a genuinely missing `null` reading is never coerced to a false zero (Number(null) === 0 trap)', () => {
    // regression: an earlier draft coerced `load1`/`cores` through a bare `Number(...)`, which turns `null` into
    // `0` (a FINITE number) rather than "absent" — this would have reported `load1: 0` for "no data" and, worse,
    // could report `held:false` off a fabricated 0/0 reading instead of the honest `no-sample` fail-open.
    const d = loadAdmissionDecision({ load1: null, cores: null });
    expect(d.load1).toBeNull();
    expect(d.cores).toBeNull();
  });
});

describe('resolveLoadAdmissionMaxPerCore / isLoadAdmissionOff (env resolution)', () => {
  it('defaults, and clamps a non-positive/garbage override back to the default', () => {
    expect(resolveLoadAdmissionMaxPerCore({})).toBe(DEFAULT_LOAD_ADMISSION_MAX_PER_CORE);
    expect(resolveLoadAdmissionMaxPerCore({ [LOAD_ADMISSION_MAX_PER_CORE_ENV]: '0' })).toBe(DEFAULT_LOAD_ADMISSION_MAX_PER_CORE);
    expect(resolveLoadAdmissionMaxPerCore({ [LOAD_ADMISSION_MAX_PER_CORE_ENV]: '-1' })).toBe(DEFAULT_LOAD_ADMISSION_MAX_PER_CORE);
    expect(resolveLoadAdmissionMaxPerCore({ [LOAD_ADMISSION_MAX_PER_CORE_ENV]: 'nope' })).toBe(DEFAULT_LOAD_ADMISSION_MAX_PER_CORE);
  });

  it('honors a real override', () => {
    expect(resolveLoadAdmissionMaxPerCore({ [LOAD_ADMISSION_MAX_PER_CORE_ENV]: '0.25' })).toBe(0.25);
  });

  it('isLoadAdmissionOff mirrors isAdmissionOff\'s own switch values, own env var', () => {
    expect(isLoadAdmissionOff({})).toBe(false);
    for (const v of ['off', 'OFF', '0', 'false', 'no']) expect(isLoadAdmissionOff({ [LOAD_ADMISSION_SWITCH_ENV]: v })).toBe(true);
    expect(isLoadAdmissionOff({ [LOAD_ADMISSION_SWITCH_ENV]: 'on' })).toBe(false);
  });
});

/** Write one host-sampler-shaped metric record — the same `{event:'metric', name, value, timestamp}` shape
 *  `telemetry-summary-io.mjs#readHostToday` filters for. */
function metricLine(name, value, timestamp) {
  return JSON.stringify({ event: 'metric', name, value, timestamp }) + '\n';
}

describe('readLatestLoad + resolveLoadAdmission (real fixture fs, injectable root — #4076)', () => {
  let telemetryRoot;
  let dayKey;
  const NOW = new Date('2026-09-25T13:00:00.000Z');

  beforeEach(() => {
    telemetryRoot = mkdtempSync(join(tmpdir(), 'load-admission-test-'));
    dayKey = utcDayKey(NOW);
  });
  afterEach(() => { rmSync(telemetryRoot, { recursive: true, force: true }); });

  it('reads the LATEST sample of each metric — later timestamp wins even if it appears earlier in the file', () => {
    const file = join(telemetryRoot, `${dayKey}.jsonl`);
    writeFileSync(file, [
      metricLine('host.cpu.load1', 20, '2026-09-25T13:00:30.000Z'), // later timestamp, written FIRST
      metricLine('host.cpu.load1', 5, '2026-09-25T13:00:00.000Z'),
      metricLine('host.cpu.count', 12, '2026-09-25T13:00:00.000Z'),
      metricLine('host.cpu.busy_pct', 90, '2026-09-25T13:00:30.000Z'), // a different metric — must not leak in
    ].join(''));
    expect(readLatestLoad({ root: telemetryRoot, now: NOW })).toEqual({ load1: 20, cores: 12 });
  });

  it('a missing day file reads as {load1:null, cores:null} — not a read error', () => {
    expect(readLatestLoad({ root: telemetryRoot, now: NOW })).toEqual({ load1: null, cores: null });
  });

  it('THE LIVE BEFORE/AFTER CONTRACT: the SAME real sampled load1/cores reading is admitted under one threshold and held under another — proves the gate reacts to the actual numbers, not a canned verdict', () => {
    const file = join(telemetryRoot, `${dayKey}.jsonl`);
    // A real reading captured off this machine's own host-sampler on 2026-09-25 (see readLatestLoad's own doc
    // comment) — not a synthetic round number, so this is the SAME shape of number the live CLI proof uses.
    writeFileSync(file, [
      metricLine('host.cpu.load1', 8.5009765625, '2026-09-25T13:04:57.144Z'),
      metricLine('host.cpu.count', 12, '2026-09-25T13:04:57.144Z'),
    ].join(''));
    const before = resolveLoadAdmission({ env: {}, root: telemetryRoot, now: NOW }); // default threshold (1.5/core)
    expect(before).toMatchObject({ held: false, load1: 8.5009765625, cores: 12 });
    expect(before.perCore).toBeCloseTo(0.7084, 3);
    // AFTER: the identical real reading, only the threshold config changed (a machine dialing WE_LOAD_ADMISSION_
    // MAX_PER_CORE down past today's own real ratio) — now HELD, off the exact same numbers.
    const after = resolveLoadAdmission({ env: { [LOAD_ADMISSION_MAX_PER_CORE_ENV]: '0.5' }, root: telemetryRoot, now: NOW });
    expect(after).toMatchObject({ held: true, load1: 8.5009765625, cores: 12, maxPerCore: 0.5 });
  });

  it('WE_LOAD_ADMISSION=off bypasses the read entirely (admits, no fixture file needed)', () => {
    const r = resolveLoadAdmission({ env: { [LOAD_ADMISSION_SWITCH_ENV]: 'off' }, root: telemetryRoot, now: NOW });
    expect(r).toEqual({ held: false, load1: null, cores: null, perCore: null, maxPerCore: DEFAULT_LOAD_ADMISSION_MAX_PER_CORE, bypassed: 'off' });
  });

  it('CI=true bypasses the read entirely (admits — a CI runner is its own machine)', () => {
    const r = resolveLoadAdmission({ env: { CI: 'true' }, root: telemetryRoot, now: NOW });
    expect(r.held).toBe(false);
    expect(r.bypassed).toBe('ci');
  });
});

describe('the `load-status` CLI mode as a real process (#4076)', () => {
  it('prints the admitted/held verdict as JSON, driven entirely by --load-root + --max-per-core (no shared pool needed)', () => {
    const telemetryRoot = mkdtempSync(join(tmpdir(), 'load-admission-cli-test-'));
    try {
      const dayKey = utcDayKey(new Date());
      writeFileSync(join(telemetryRoot, `${dayKey}.jsonl`), [
        metricLine('host.cpu.load1', 10, new Date().toISOString()),
        metricLine('host.cpu.count', 4, new Date().toISOString()),
      ].join(''));
      const env = { ...process.env }; delete env.CI; delete env.WE_LOAD_ADMISSION;
      const admitted = JSON.parse(execFileSync(process.execPath, [CLI, 'load-status', '--json', `--load-root=${telemetryRoot}`, '--max-per-core=3'], { encoding: 'utf8', env }));
      expect(admitted).toEqual({ held: false, load1: 10, cores: 4, perCore: 2.5, maxPerCore: 3 });
      const held = JSON.parse(execFileSync(process.execPath, [CLI, 'load-status', '--json', `--load-root=${telemetryRoot}`, '--max-per-core=2'], { encoding: 'utf8', env }));
      expect(held).toEqual({ held: true, load1: 10, cores: 4, perCore: 2.5, maxPerCore: 2 });
    } finally {
      rmSync(telemetryRoot, { recursive: true, force: true });
    }
  });
});
