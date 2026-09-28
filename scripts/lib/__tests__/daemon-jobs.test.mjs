/**
 * @file scripts/lib/__tests__/daemon-jobs.test.mjs
 * @description #4125 — the pure job policy: classify (live / stalled / dead / launching / foreign), the
 *   reattach plan and its 3-attempt cap, the per-daemon cap and serial lane, the sleep rule, snapshot-store
 *   eviction, and the record transitions.
 */
import { describe, it, expect } from 'vitest';

import {
  admitJobs, backoffMs, classifyJob, defineJobKind, detectSleep, kindRegistry, markClaimed, markCheckpoint,
  markLaunching, markQueued, markRequeued, planReattach, selectEvictions, SLEEP_GAP_THRESHOLD_MS,
} from '../daemon-jobs.mjs';
import { newJobRunRecord } from '../../operations/run-record.mjs';

const T0 = Date.parse('2026-09-28T12:00:00.000Z');
const at = (ms) => new Date(ms).toISOString();
const HANDLE = 'host-a:4242:Mon Sep 28 12:00:00 2026';

function running(overrides = {}, { heartbeatAt = T0, attempts = 1 } = {}) {
  let r = markQueued(newJobRunRecord({ id: overrides.id ?? 'job-1', kind: overrides.kind ?? 'noop', codeSha: 'sha' }), { at: at(T0 - 1000) });
  for (let i = 0; i < attempts; i += 1) r = markLaunching(r, { at: at(T0) });
  r = markClaimed(r, { at: at(heartbeatAt), handle: HANDLE, host: 'host-a', pid: 4242, procStart: 'Mon Sep 28 12:00:00 2026' });
  return r;
}

const kinds = kindRegistry([
  defineJobKind({ kind: 'noop', entry: 'scripts/noop.mjs' }),
  defineJobKind({ kind: 'writer', entry: 'scripts/writer.mjs', serial: true }),
  defineJobKind({ kind: 'session', entry: 'scripts/session.mjs', resumable: false }),
]);

describe('classifyJob', () => {
  it('live pid + fresh heartbeat = live; live pid + stale heartbeat = stalled', () => {
    const r = running();
    expect(classifyJob(r, { now: T0 + 10_000, liveness: 'alive', staleMs: 60_000 })).toBe('live');
    expect(classifyJob(r, { now: T0 + 61_000, liveness: 'alive', staleMs: 60_000 })).toBe('stalled');
  });

  it('a dead or reused pid is dead regardless of heartbeat; another host is foreign', () => {
    expect(classifyJob(running(), { now: T0 + 1, liveness: 'dead' })).toBe('dead');
    expect(classifyJob(running(), { now: T0 + 999_999, liveness: 'foreign' })).toBe('foreign');
  });

  it('the sleep rule skips staleness only on the tick it fires, never the dead check', () => {
    const r = running();
    expect(classifyJob(r, { now: T0 + 600_000, liveness: 'alive', sleepDetected: true })).toBe('live');
    expect(classifyJob(r, { now: T0 + 600_000, liveness: 'alive', sleepDetected: false })).toBe('stalled');
    expect(classifyJob(r, { now: T0 + 600_000, liveness: 'dead', sleepDetected: true })).toBe('dead');
  });

  it('an unclaimed launch is launching within the grace and dead after it', () => {
    const r = markLaunching(markQueued(newJobRunRecord({ id: 'j', kind: 'noop', codeSha: 's' }), { at: at(T0) }), { at: at(T0) });
    expect(classifyJob(r, { now: T0 + 5_000, liveness: null, launchGraceMs: 30_000 })).toBe('launching');
    expect(classifyJob(r, { now: T0 + 31_000, liveness: null, launchGraceMs: 30_000 })).toBe('dead');
  });

  it('queued is waiting until nextAttemptAt, terminal stays terminal', () => {
    const q = markRequeued(running(), { at: at(T0), now: T0, reason: 'x', backoffBaseMs: 1000 });
    expect(classifyJob(q, { now: T0 + 500, liveness: null })).toBe('waiting');
    expect(classifyJob(q, { now: T0 + 1000, liveness: null })).toBe('queued');
    const done = { ...q, job: { ...q.job, status: 'succeeded' } };
    expect(classifyJob(done, { now: T0, liveness: 'dead' })).toBe('terminal');
  });
});

describe('planReattach', () => {
  it('leaves live/launching/foreign alone', () => {
    for (const s of ['live', 'launching', 'foreign', 'queued', 'waiting', 'terminal']) {
      expect(planReattach(running(), s, { kindDef: kinds.get('noop') }).type).toBe('none');
    }
  });

  it('dead resumes from the checkpoint; stalled stops first; a non-resumable kind restarts', () => {
    expect(planReattach(running(), 'dead', { kindDef: kinds.get('noop') })).toMatchObject({ type: 'requeue', resume: true, stopFirst: false });
    expect(planReattach(running(), 'stalled', { kindDef: kinds.get('noop') })).toMatchObject({ type: 'requeue', stopFirst: true });
    expect(planReattach(running({ kind: 'session' }), 'dead', { kindDef: kinds.get('session') })).toMatchObject({ resume: false });
  });

  it('fails visibly after 3 attempts, and when the daemon no longer declares the kind', () => {
    const third = running({}, { attempts: 3 });
    expect(planReattach(third, 'dead', { kindDef: kinds.get('noop') })).toMatchObject({ type: 'fail', reason: expect.stringMatching(/3\/3/) });
    expect(planReattach(third, 'stalled', { kindDef: kinds.get('noop') })).toMatchObject({ type: 'fail', stopFirst: true });
    expect(planReattach(running(), 'dead', { kindDef: null })).toMatchObject({ type: 'fail', reason: expect.stringMatching(/not declared/) });
  });

  it('requeue keeps the checkpoint on resume and rewinds it otherwise; backoff doubles', () => {
    const r = markCheckpoint(running(), { at: at(T0), step: 2, data: { k: 1 } });
    expect(markRequeued(r, { at: at(T0), now: T0, reason: 'x', resume: true }).job.checkpoint).toEqual({ step: 2, data: { k: 1 } });
    expect(markRequeued(r, { at: at(T0), now: T0, reason: 'x', resume: false }).job.checkpoint).toEqual({ step: 0, data: {} });
    expect([1, 2, 3].map((n) => backoffMs(n, 1000))).toEqual([1000, 2000, 4000]);
  });
});

describe('admitJobs — per-daemon cap and serial lane', () => {
  const queued = (id, kind, t) => markQueued(newJobRunRecord({ id, kind, codeSha: 's' }), { at: at(T0 + t) });

  it('admits oldest first up to the cap, counting launching and running jobs', () => {
    const records = [running({ id: 'r1' }), queued('q2', 'noop', 2), queued('q1', 'noop', 1), queued('q3', 'noop', 3)];
    expect(admitJobs({ records, kinds, maxConcurrent: 3, now: T0 + 10 })).toEqual(['q1', 'q2']);
    expect(admitJobs({ records, kinds, maxConcurrent: 1, now: T0 + 10 })).toEqual([]);
  });

  it('runs at most one serial job at a time, without blocking other kinds', () => {
    const records = [queued('w1', 'writer', 1), queued('w2', 'writer', 2), queued('n1', 'noop', 3)];
    expect(admitJobs({ records, kinds, maxConcurrent: 5, now: T0 + 10 })).toEqual(['w1', 'n1']);
    const busy = [running({ id: 'w0', kind: 'writer' }), ...records];
    expect(admitJobs({ records: busy, kinds, maxConcurrent: 5, now: T0 + 10 })).toEqual(['n1']);
  });

  it('skips jobs still backing off and kinds the daemon does not declare', () => {
    const backing = markRequeued(running({ id: 'b' }), { at: at(T0), now: T0, reason: 'x', backoffBaseMs: 60_000 });
    const records = [backing, queued('u', 'unknown-kind', 1)];
    expect(admitJobs({ records, kinds, maxConcurrent: 5, now: T0 + 1 })).toEqual([]);
    expect(admitJobs({ records, kinds, maxConcurrent: 5, now: T0 + 60_000 })).toEqual(['b']);
  });

  it('refuses a non-positive cap', () => {
    expect(() => admitJobs({ records: [], kinds, maxConcurrent: 0, now: T0 })).toThrow(/maxConcurrent/);
  });
});

describe('detectSleep', () => {
  it('fires when the wall clock ran ahead of the monotonic clock past the threshold', () => {
    const prev = { wallMs: 0, monoMs: 0 };
    expect(detectSleep(prev, { wallMs: 5_000, monoMs: 5_000 })).toEqual({ slept: false, gapMs: 0 });
    // a blocked event loop moves both clocks: no sleep
    expect(detectSleep(prev, { wallMs: 120_000, monoMs: 119_500 }).slept).toBe(false);
    // host asleep 10 minutes: wall moved, monotonic did not
    expect(detectSleep(prev, { wallMs: 605_000, monoMs: 5_000 })).toEqual({ slept: true, gapMs: 600_000 });
    // exactly at the threshold is not a sleep; a backwards wall step is not a sleep
    expect(detectSleep(prev, { wallMs: SLEEP_GAP_THRESHOLD_MS + 1000, monoMs: 1000 }).slept).toBe(false);
    expect(detectSleep(prev, { wallMs: -60_000, monoMs: 5_000 }).slept).toBe(false);
    expect(detectSleep(null, { wallMs: 1, monoMs: 1 }).slept).toBe(false);
  });
});

describe('selectEvictions', () => {
  const stores = [
    { key: 'a', mtimeMs: 1 }, { key: 'b', mtimeMs: 2 }, { key: 'c', mtimeMs: 3 }, { key: 'd', mtimeMs: 4 },
  ];

  it('keeps the newest two when nothing is referenced', () => {
    expect(selectEvictions({ stores, referenced: [] }).sort()).toEqual(['a', 'b']);
  });

  it('never evicts a referenced store, and referenced stores count toward the two', () => {
    expect(selectEvictions({ stores, referenced: ['a'] }).sort()).toEqual(['b', 'c']);
    expect(selectEvictions({ stores, referenced: ['a', 'b', 'c'] })).toEqual(['d']);
  });
});

describe('defineJobKind', () => {
  it('refuses a mutates-tree kind with no worktree provider, and an absolute or escaping entry', () => {
    expect(() => defineJobKind({ kind: 'm', entry: 'x.mjs', codeMode: 'mutates-tree' })).toThrow(/prepareWorktree/);
    expect(() => defineJobKind({ kind: 'm', entry: '/abs.mjs' })).toThrow(/repo-relative/);
    expect(() => defineJobKind({ kind: 'm', entry: '../up.mjs' })).toThrow(/repo-relative/);
    expect(() => kindRegistry([{ kind: 'x', entry: 'a' }, { kind: 'x', entry: 'b' }])).toThrow(/twice/);
  });
});
