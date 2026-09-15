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
  acquireSlotBlocking, admissionStatus, runUnderAdmission, shellQuoteWord,
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
      now: () => clock, sleep: async (ms) => { clock += ms; }, timeoutMs: 3000, pollMs: 1000,
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
