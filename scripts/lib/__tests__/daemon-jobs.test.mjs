/**
 * @file scripts/lib/__tests__/daemon-jobs.test.mjs
 * @description #4125 — the pure core of the daemon job model: the record (through the run store's own
 *   validator), the `host:pid:procStart` handle, reattach, retry cap, caps, the sleep rule and store eviction.
 *   The real-process half (launch, kill -9, SIGSTOP, restart) is `daemon-jobs-io.test.mjs`.
 */
import { describe, it, expect } from 'vitest';

import {
  DEFAULT_MAX_ATTEMPTS, SLEEP_GAP_THRESHOLD_MS, backoffMs, decideReattach, decideRetry, detectSleep, formatHandle,
  judgeHandle, newJobRecord, parseHandle, planAdmissions, planStoreEviction, referencedStores, withJob,
} from '../daemon-jobs.mjs';
import { parseRunRecord, serializeRunRecord, validateRunRecord } from '../../operations/run-record.mjs';
import { createMemoryRunStore, isRunRecordTerminal } from '../../operations/run-store.mjs';

const T0 = '2026-09-28T10:00:00.000Z';
const ms = (iso) => Date.parse(iso);
const START = 'Mon Sep 28 11:02:12 2026';
const HANDLE = `mac:4242:${START}`;

function job(overrides = {}, id = 'job-a') {
  const base = newJobRecord({
    id, kind: 'noop-test', daemon: 'review', module: 'scripts/lib/daemon-job-kinds/noop.mjs',
    codeMode: 'readonly-tree', codeSha: 'abc1234', input: { steps: 2 }, now: T0,
  });
  return withJob(base, overrides);
}

describe('the job record is a run-store record kind', () => {
  it('a new job record passes the run store\'s own validator and round-trips through serialize/parse', () => {
    const rec = job();
    expect(validateRunRecord(rec)).toEqual({ ok: true, errors: [] });
    const parsed = parseRunRecord(serializeRunRecord(rec));
    expect(parsed.ok).toBe(true);
    expect(parsed.record.job).toMatchObject({ kind: 'noop-test', status: 'queued', attempts: 0, maxAttempts: DEFAULT_MAX_ATTEMPTS, codeSha: 'abc1234' });
    expect(parsed.record.op).toBe('job:noop-test');
  });

  it('carries the card\'s fields: id, kind, input, pid, host, startedAt, heartbeatAt, checkpoint, status, codeSha, attempts', () => {
    const rec = job();
    expect(rec).toMatchObject({ id: 'job-a', input: { steps: 2 } });
    for (const k of ['kind', 'pid', 'host', 'startedAt', 'heartbeatAt', 'checkpoint', 'status', 'codeSha', 'attempts']) {
      expect(rec.job).toHaveProperty(k);
    }
  });

  it('the memory store (the file store\'s twin) refuses a torn job block on write', () => {
    const store = createMemoryRunStore();
    expect(() => store.write(withJob(job(), { status: 'exploded' }))).toThrow(/job.status/);
    expect(() => store.write(withJob(job(), { status: 'running', handle: null }))).toThrow(/running job must carry its handle/);
    expect(() => store.write(withJob(job(), { handle: '4242' }))).toThrow(/host:pid:procStart/);
    expect(() => store.write({ ...job(), op: 'job:other-kind' })).toThrow(/op must be/);
    expect(() => store.write(withJob(job(), { module: '../../etc/x.mjs' }))).toThrow(/repo-relative/);
    expect(() => store.write(withJob(job(), { codeMode: 'anywhere' }))).toThrow(/codeMode/);
    expect(() => store.write(withJob(job(), { workdir: 'relative/dir' }))).toThrow(/job.workdir/);
    expect(() => store.write(withJob(job(), { workdir: '/x/worktrees/../../home' }))).toThrow(/job.workdir/);
    store.write(job());
    expect(store.read('job-a').job.status).toBe('queued');
  });

  it('an ordinary run record without a job block is unaffected', () => {
    const { job: _drop, op: _op, ...plain } = job();
    expect(validateRunRecord({ ...plain, op: 'review-pr' }).ok).toBe(true);
  });

  it('pruning never treats a live job as terminal, and does treat a finished one as terminal', () => {
    for (const status of ['queued', 'launching', 'errored']) expect(isRunRecordTerminal(withJob(job(), { status }))).toBe(false);
    expect(isRunRecordTerminal(withJob(job(), { status: 'running', handle: HANDLE }))).toBe(false);
    expect(isRunRecordTerminal(withJob(job(), { status: 'succeeded' }))).toBe(true);
    expect(isRunRecordTerminal(withJob(job(), { status: 'failed' }))).toBe(true);
  });

  it('the timeline is bounded', () => {
    let rec = job();
    for (let i = 0; i < 80; i++) rec = withJob(rec, {}, { at: T0, event: `e${i}` });
    expect(rec.job.timeline).toHaveLength(50);
    expect(rec.job.timeline.at(-1).event).toBe('e79');
  });
});

describe('the handle is host:pid:procStart — a bare pid is never a handle', () => {
  it('formats and parses back, even though the start time contains colons', () => {
    expect(formatHandle({ host: 'mac', pid: 4242, procStart: '  Mon Sep 28  11:02:12 2026 ' })).toBe(HANDLE);
    expect(parseHandle(HANDLE)).toEqual({ host: 'mac', pid: 4242, procStart: START });
  });

  it('refuses a bare pid, a missing start time, a bad pid or a host with a colon', () => {
    expect(() => formatHandle({ host: 'mac', pid: 4242, procStart: '' })).toThrow(/bare pid/);
    expect(() => formatHandle({ host: 'mac', pid: 0, procStart: START })).toThrow(/pid/);
    expect(() => formatHandle({ host: 'a:b', pid: 1, procStart: START })).toThrow(/host/);
    for (const bad of ['4242', 'mac:4242', 'mac:4242:', 'mac:04242:x', ':4242:x', 'mac:-1:x', null, 42]) {
      expect(parseHandle(bad)).toBeNull();
    }
  });

  it('pid reuse is refused: a live pid whose start time differs is not our job', () => {
    expect(judgeHandle(HANDLE, { host: 'mac', procStart: 'Tue Sep 29 09:00:00 2026' })).toBe('reused');
    expect(judgeHandle(HANDLE, { host: 'mac', procStart: START })).toBe('alive');
    expect(judgeHandle(HANDLE, { host: 'mac', procStart: `  ${START.replace(' ', '  ')}` })).toBe('alive');
    expect(judgeHandle(HANDLE, { host: 'mac', procStart: null })).toBe('dead');
    expect(judgeHandle(HANDLE, { host: 'other', procStart: START })).toBe('foreign');
    expect(judgeHandle(HANDLE, { host: 'mac', procStart: undefined })).toBe('unknown');
    expect(judgeHandle('4242', { host: 'mac', procStart: START })).toBe('invalid');
  });
});

describe('reattach', () => {
  const now = ms(T0) + 60_000;
  const running = (o = {}) => withJob(job(), {
    status: 'running', attempts: 1, handle: HANDLE, launchedAt: T0, startedAt: T0, heartbeatAt: new Date(now - 5_000).toISOString(), ...o,
  });

  it('live handle + fresh heartbeat → leave it alone', () => {
    expect(decideReattach(running(), { nowMs: now, verdict: 'alive' }).action).toBe('leave');
  });

  it('live handle + stale heartbeat → stalled, kill it', () => {
    const d = decideReattach(running({ heartbeatAt: T0 }), { nowMs: ms(T0) + 200_000, verdict: 'alive', staleMs: 120_000 });
    expect(d).toMatchObject({ action: 'kill-stalled' });
  });

  it('dead or reused handle → requeue with backoff to resume from the checkpoint', () => {
    for (const verdict of ['dead', 'reused']) {
      const d = decideReattach(running({ checkpoint: { step: 1 } }), { nowMs: now, verdict });
      expect(d.action).toBe('requeue');
      expect(d.nextAttemptAt).toBe(now + backoffMs(1));
    }
  });

  it('never kills on doubt: unknown/foreign/invalid verdicts leave the job', () => {
    for (const verdict of ['unknown', 'foreign', 'invalid']) {
      expect(decideReattach(running({ heartbeatAt: T0 }), { nowMs: now + 10 ** 7, verdict }).action).toBe('none');
    }
  });

  it('an errored attempt is retried like a dead one', () => {
    expect(decideReattach(withJob(job(), { status: 'errored', attempts: 1, lastError: 'boom' }), { nowMs: now }).action).toBe('requeue');
  });

  it('a launch with no handle waits out the grace, then counts as lost', () => {
    const launching = withJob(job(), { status: 'launching', attempts: 1, launchedAt: T0 });
    expect(decideReattach(launching, { nowMs: ms(T0) + 5_000, launchGraceMs: 30_000 }).action).toBe('wait');
    expect(decideReattach(launching, { nowMs: ms(T0) + 31_000, launchGraceMs: 30_000 })).toMatchObject({ action: 'requeue' });
  });

  it('terminal and queued jobs are not reattach\'s business', () => {
    for (const status of ['succeeded', 'failed', 'queued']) {
      expect(decideReattach(withJob(job(), { status }), { nowMs: now }).action).toBe('none');
    }
  });

  it('up to 3 attempts, then fail visibly', () => {
    expect(decideRetry(withJob(job(), { attempts: 2 }), { nowMs: now, reason: 'handle dead' }).action).toBe('requeue');
    const d = decideRetry(withJob(job(), { attempts: 3 }), { nowMs: now, reason: 'handle dead' });
    expect(d).toEqual({ action: 'fail', reason: 'handle dead; 3/3 attempts used' });
  });

  it('backoff doubles and is capped', () => {
    expect([1, 2, 3].map((n) => backoffMs(n))).toEqual([30_000, 60_000, 120_000]);
    expect(backoffMs(20)).toBe(600_000);
  });
});

describe('the sleep rule: wall-clock gap against monotonic gap', () => {
  it('fires only when wall − monotonic exceeds the threshold', () => {
    const prev = { wallMs: 1_000_000, monoMs: 500 };
    expect(detectSleep(null, prev).fired).toBe(false); // boot: nothing to compare
    expect(detectSleep(prev, { wallMs: 1_005_000, monoMs: 5_500 })).toMatchObject({ fired: false, sleptMs: 0 });
    expect(detectSleep(prev, { wallMs: 1_000_000 + 3_600_000, monoMs: 5_500 })).toMatchObject({ fired: true, sleptMs: 3_595_000 });
    // A slow tick (both clocks moved a lot) is NOT a sleep.
    expect(detectSleep(prev, { wallMs: 1_000_000 + 600_000, monoMs: 500 + 600_000 }).fired).toBe(false);
    expect(detectSleep(prev, { wallMs: 1_000_000 + SLEEP_GAP_THRESHOLD_MS, monoMs: 500 }).fired).toBe(false);
    expect(detectSleep(prev, { wallMs: 1_000_000 + SLEEP_GAP_THRESHOLD_MS + 1, monoMs: 500 }).fired).toBe(true);
  });

  it('when it fires, a stale-looking live job is left alone — but a dead one is still dead', () => {
    const stale = withJob(job(), { status: 'running', attempts: 1, handle: HANDLE, heartbeatAt: T0 });
    const later = ms(T0) + 3_600_000;
    expect(decideReattach(stale, { nowMs: later, verdict: 'alive', skipStaleness: true }).action).toBe('leave');
    expect(decideReattach(stale, { nowMs: later, verdict: 'dead', skipStaleness: true }).action).toBe('requeue');
  });

  it('after a wake, heartbeat age is measured from the wake — then a stuck job is caught one window later', () => {
    const stale = withJob(job(), { status: 'running', attempts: 1, handle: HANDLE, heartbeatAt: T0 });
    const wake = ms(T0) + 3_600_000;
    expect(decideReattach(stale, { nowMs: wake + 60_000, verdict: 'alive', wakeAtMs: wake, staleMs: 120_000 }).action).toBe('leave');
    expect(decideReattach(stale, { nowMs: wake + 121_000, verdict: 'alive', wakeAtMs: wake, staleMs: 120_000 }).action).toBe('kill-stalled');
  });
});

describe('caps and the serial lane', () => {
  const kinds = {
    'noop-test': { module: 'x.mjs', codeMode: 'readonly-tree' },
    'drain-followup': { module: 'y.mjs', codeMode: 'mutates-tree', serial: true },
    'land-pr': { module: 'z.mjs', codeMode: 'mutates-tree', serial: true },
    capped: { module: 'c.mjs', codeMode: 'readonly-tree', maxConcurrent: 1 },
  };
  const q = (id, kind, createdAt = T0, extra = {}) => withJob(
    { ...job({}, id), op: `job:${kind}` }, { kind, createdAt, ...extra },
  );
  const nowMs = ms(T0) + 1_000;

  it('the daemon cap bounds concurrent jobs, FIFO', () => {
    const recs = ['a', 'b', 'c'].map((id, i) => q(id, 'noop-test', new Date(ms(T0) + i).toISOString()));
    const plan = planAdmissions(recs, { kinds, maxConcurrent: 2, nowMs });
    expect(plan.launch).toEqual(['a', 'b']);
    expect(plan.deferred).toEqual([{ id: 'c', reason: 'daemon cap' }]);
  });

  it('running jobs count against the cap', () => {
    const recs = [q('r', 'noop-test', T0, { status: 'running', handle: HANDLE }), q('a', 'noop-test')];
    expect(planAdmissions(recs, { kinds, maxConcurrent: 1, nowMs }).launch).toEqual([]);
  });

  it('single-writer kinds share one serial lane', () => {
    const recs = [q('d1', 'drain-followup'), q('l1', 'land-pr', '2026-09-28T10:00:00.001Z'), q('n1', 'noop-test', '2026-09-28T10:00:00.002Z')];
    const plan = planAdmissions(recs, { kinds, maxConcurrent: 5, nowMs });
    expect(plan.launch).toEqual(['d1', 'n1']);
    expect(plan.deferred).toEqual([{ id: 'l1', reason: 'serial lane busy' }]);
    const busy = [q('d0', 'drain-followup', T0, { status: 'launching', attempts: 1, launchedAt: T0 }), q('l1', 'land-pr')];
    expect(planAdmissions(busy, { kinds, maxConcurrent: 5, nowMs }).launch).toEqual([]);
  });

  it('a per-kind cap applies on top', () => {
    const recs = [q('c1', 'capped'), q('c2', 'capped', '2026-09-28T10:00:00.001Z')];
    expect(planAdmissions(recs, { kinds, maxConcurrent: 5, nowMs }).launch).toEqual(['c1']);
  });

  it('a requeued job waits for its backoff; an unknown kind is reported, never launched', () => {
    const recs = [q('later', 'noop-test', T0, { nextAttemptAt: new Date(nowMs + 10_000).toISOString() }), q('ghost', 'nope')];
    const plan = planAdmissions(recs, { kinds, maxConcurrent: 5, nowMs });
    expect(plan.launch).toEqual([]);
    expect(plan.unknownKind).toEqual(['ghost']);
  });
});

describe('snapshot store eviction', () => {
  const stores = [
    { key: 'h1', mtimeMs: 1 }, { key: 'h2', mtimeMs: 2 }, { key: 'h3', mtimeMs: 3 }, { key: 'h4', mtimeMs: 4 },
  ];

  it('keeps at most 2, newest first, when nothing references them', () => {
    expect(planStoreEviction(stores, [])).toEqual({ keep: ['h4', 'h3'], evict: ['h2', 'h1'] });
  });

  it('never evicts a store a live job references, even past the keep limit', () => {
    expect(planStoreEviction(stores, ['h1', 'h2', 'h3'])).toEqual({ keep: ['h1', 'h2', 'h3'], evict: ['h4'] });
  });

  it('references come from live jobs only; a finished job holds nothing', () => {
    const live = withJob(job({}, 'live'), { status: 'running', handle: HANDLE, storeKey: 'h1' });
    const done = withJob(job({}, 'done'), { status: 'succeeded', storeKey: 'h2', codeSha: 'def5678' });
    const { storeKeys, snapshotKeys } = referencedStores([live, done]);
    expect([...storeKeys]).toEqual(['h1']);
    expect([...snapshotKeys]).toEqual(['abc1234']);
  });
});
