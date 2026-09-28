/**
 * @file scripts/lib/__tests__/daemon-jobs-io.test.mjs
 * @description #4125 — the daemon job model against REAL processes: every job here is a real detached
 *   `daemon-job-runner.mjs` child running the no-op test kind, probed with the real `ps`, killed with real
 *   signals. Records live under a `mkdtemp` `DAEMON_JOBS_ROOT`-style root, never `~/.claude`. The workdir is
 *   this checkout itself (the snapshot/worktree builders have their own suite, `daemon-jobs-workdir.test.mjs`).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { createJobDaemon, handleOf, killStalledJob, openJobStore, probeHandle, readProcStart } from '../daemon-jobs-io.mjs';
import { formatHandle, parseHandle, withJob } from '../daemon-jobs.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const RUNNER = join(REPO_ROOT, 'scripts/lib/daemon-job-runner.mjs');
const KINDS = {
  'noop-test': { module: 'scripts/lib/daemon-job-kinds/noop.mjs', codeMode: 'readonly-tree' },
  'throws-test': { module: 'scripts/lib/__tests__/fixtures/daemon-job-throws.mjs', codeMode: 'readonly-tree' },
  'noop-mutates': { module: 'scripts/lib/daemon-job-kinds/noop.mjs', codeMode: 'mutates-tree' },
};
const SHA = 'abc1234';

const tmp = [];
const pids = new Set();
function mkTmp(prefix) {
  const d = mkdtempSync(join(tmpdir(), prefix));
  tmp.push(d);
  return d;
}
afterEach(() => {
  for (const pid of pids) { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }
  pids.clear();
  for (const d of tmp.splice(0)) rmSync(d, { recursive: true, force: true });
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mkDaemon(root, opts = {}) {
  const alerts = [];
  const d = createJobDaemon({
    daemon: 'test-daemon', kinds: KINDS, root, maxConcurrent: 2,
    prepareWorkdir: async () => ({ dir: REPO_ROOT, storeKey: null, ...(opts.cloneRoot ? { cloneRoot: opts.cloneRoot } : {}) }),
    env: { ...process.env, DAEMON_JOB_HEARTBEAT_MS: '100', ...(opts.env ?? {}) },
    staleMs: 1_500, launchGraceMs: 5_000, backoffBaseMs: 50,
    killStalled: (h) => killStalledJob(h, { termGraceMs: 500, killGraceMs: 2_000, pollMs: 50 }),
    alert: (m) => alerts.push(m),
    ...opts,
  });
  d.alerts = alerts;
  return d;
}

/** Tick until `pred(record)` holds; remembers every pid seen so afterEach can clean up. */
async function tickUntil(d, id, pred, { timeoutMs = 20_000, everyMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    await d.tick();
    const rec = d.store.read(id);
    if (rec?.job?.pid) pids.add(rec.job.pid);
    if (pred(rec)) return rec;
    if (Date.now() > deadline) throw new Error(`timed out; last record: ${JSON.stringify(rec?.job, null, 1)}`);
    await sleep(everyMs);
  }
}

async function waitRecord(store, id, pred, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const rec = store.read(id);
    if (rec?.job?.pid) pids.add(rec.job.pid);
    if (pred(rec)) return rec;
    if (Date.now() > deadline) throw new Error(`timed out waiting; last: ${JSON.stringify(rec?.job)}`);
    await sleep(50);
  }
}

function traceEvents(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
const events = (rec) => rec.job.timeline.map((t) => t.event);

describe('launch: the job runs detached and the tick never waits on it', () => {
  it('runs the no-op job to success once, with a full timeline', async () => {
    const root = mkTmp('dj-root-');
    const traceFile = join(root, 'trace.jsonl');
    const d = mkDaemon(root);
    d.enqueue({ id: 'noop-1', kind: 'noop-test', codeSha: SHA, input: { steps: 3, stepMs: 250, traceFile } });
    const t0 = Date.now();
    const s = await d.tick();
    expect(Date.now() - t0).toBeLessThan(3_000); // the job itself takes ≥750ms plus node start-up
    expect(s.launched).toEqual(['noop-1']);
    const done = await tickUntil(d, 'noop-1', (r) => r.job.status === 'succeeded');
    expect(done.job).toMatchObject({ attempts: 1, checkpoint: { step: 3 }, result: { steps: 3, resumedFrom: 0 }, handle: null });
    expect(events(done)).toEqual(['queued', 'launch', 'started', 'checkpoint', 'checkpoint', 'checkpoint', 'succeeded']);
    expect(traceEvents(traceFile).map((e) => e.event)).toEqual(['start', 'finish']);
    expect(existsSync(join(root, 'test-daemon', 'logs', 'noop-1.log'))).toBe(true);
  }, 30_000);

  it('runs from a workdir reached through a symlink (the runner\'s entry-point check compares realpaths)', async () => {
    const root = mkTmp('dj-root-');
    const link = join(mkTmp('dj-link-'), 'checkout');
    symlinkSync(REPO_ROOT, link, 'dir');
    const d = mkDaemon(root, { prepareWorkdir: async () => ({ dir: link, storeKey: null }) });
    d.enqueue({ id: 'via-link', kind: 'noop-test', codeSha: SHA, input: { steps: 1, stepMs: 10 } });
    const done = await tickUntil(d, 'via-link', (r) => ['succeeded', 'failed'].includes(r.job.status));
    expect(done.job).toMatchObject({ status: 'succeeded', attempts: 1 });
  }, 30_000);

  it('enqueue is idempotent on id — the same work is never queued twice', () => {
    const root = mkTmp('dj-root-');
    const d = mkDaemon(root);
    const a = d.enqueue({ id: 'same', kind: 'noop-test', codeSha: SHA, input: { steps: 1 } });
    const b = d.enqueue({ id: 'same', kind: 'noop-test', codeSha: SHA, input: { steps: 99 } });
    expect(b.input).toEqual(a.input);
    expect(() => d.enqueue({ id: 'x', kind: 'not-a-kind' })).toThrow(/unknown job kind/);
  });
});

describe('reattach after a daemon restart', () => {
  it('a second daemon instance leaves the live job alone; it finishes once and is not started twice', async () => {
    const root = mkTmp('dj-root-');
    const traceFile = join(root, 'trace.jsonl');
    const first = mkDaemon(root);
    first.enqueue({ id: 'survivor', kind: 'noop-test', codeSha: SHA, input: { steps: 6, stepMs: 200, traceFile } });
    await tickUntil(first, 'survivor', (r) => r.job.status === 'running' && r.job.checkpoint?.step >= 1);
    // "restart": a fresh instance with no memory of the first — boot is its first tick.
    const second = mkDaemon(root);
    const boot = await second.tick();
    expect(boot.booting).toBe(true);
    expect(boot.decisions).toEqual([expect.objectContaining({ id: 'survivor', verdict: 'alive', action: 'leave' })]);
    const done = await tickUntil(second, 'survivor', (r) => r.job.status === 'succeeded');
    expect(done.job.attempts).toBe(1);
    expect(traceEvents(traceFile).map((e) => e.event)).toEqual(['start', 'finish']);
  }, 30_000);
});

describe('dead handle → resume from the last applied step', () => {
  it('kill -9 of the job: the next tick requeues it and the relaunch resumes from the checkpoint', async () => {
    const root = mkTmp('dj-root-');
    const traceFile = join(root, 'trace.jsonl');
    const d = mkDaemon(root);
    d.enqueue({ id: 'victim', kind: 'noop-test', codeSha: SHA, input: { steps: 6, stepMs: 200, traceFile } });
    const mid = await tickUntil(d, 'victim', (r) => r.job.status === 'running' && r.job.checkpoint?.step >= 2);
    process.kill(mid.job.pid, 'SIGKILL');
    const done = await tickUntil(d, 'victim', (r) => r.job.status === 'succeeded');
    expect(done.job.attempts).toBe(2);
    const requeued = done.job.timeline.find((t) => t.event === 'requeued');
    expect(requeued).toMatchObject({ detail: 'handle dead', attempt: 1 });
    const starts = traceEvents(traceFile).filter((e) => e.event === 'start');
    expect(starts).toHaveLength(2);
    expect(starts[1].from).toBeGreaterThanOrEqual(2);
    expect(traceEvents(traceFile).filter((e) => e.event === 'finish')).toHaveLength(1);
  }, 30_000);

  it('a job that keeps failing gets 3 attempts, then fails visibly', async () => {
    const root = mkTmp('dj-root-');
    const traceFile = join(root, 'trace.jsonl');
    const d = mkDaemon(root);
    d.enqueue({ id: 'doomed', kind: 'throws-test', codeSha: SHA, input: { traceFile } });
    const failed = await tickUntil(d, 'doomed', (r) => r.job.status === 'failed');
    expect(failed.job.attempts).toBe(3);
    expect(failed.job.lastError).toMatch(/deliberate failure on attempt 3.*3\/3 attempts used/);
    expect(traceEvents(traceFile)).toHaveLength(3);
    expect(d.alerts.some((a) => /doomed \(throws-test\) FAILED/.test(a))).toBe(true);
    await d.tick();
    expect(traceEvents(traceFile)).toHaveLength(3); // a failed job is never relaunched
  }, 30_000);
});

describe('stalled: a live pid with a stale heartbeat', () => {
  it('a frozen job (SIGSTOP) is killed and relaunched exactly once', async () => {
    const root = mkTmp('dj-root-');
    const traceFile = join(root, 'trace.jsonl');
    const d = mkDaemon(root);
    d.enqueue({ id: 'frozen', kind: 'noop-test', codeSha: SHA, input: { steps: 4, stepMs: 200, traceFile } });
    const mid = await tickUntil(d, 'frozen', (r) => r.job.status === 'running' && r.job.checkpoint?.step >= 1);
    process.kill(mid.job.pid, 'SIGSTOP');
    const done = await tickUntil(d, 'frozen', (r) => r.job.status === 'succeeded');
    expect(done.job.attempts).toBe(2);
    const killed = done.job.timeline.filter((t) => t.event === 'killed-stalled');
    expect(killed).toHaveLength(1);
    expect(killed[0].detail).toMatch(/stalled: heartbeat .*SIGTERM→SIGKILL/); // a stopped process ignores TERM
    expect(readProcStart(mid.job.pid)).toBeNull();
    expect(traceEvents(traceFile).filter((e) => e.event === 'start')).toHaveLength(2);
    expect(traceEvents(traceFile).filter((e) => e.event === 'finish')).toHaveLength(1);
  }, 30_000);

  it('the sleep rule: the tick that detects a sleep does not kill a stale-looking job; a stuck one dies a window later', async () => {
    const root = mkTmp('dj-root-');
    let offset = 0;
    const clock = { wall: () => Date.now() + offset, mono: () => Number(process.hrtime.bigint() / 1_000_000n) };
    const d = mkDaemon(root, { clock });
    d.enqueue({ id: 'sleeper', kind: 'noop-test', codeSha: SHA, input: { steps: 50, stepMs: 200 } });
    const mid = await tickUntil(d, 'sleeper', (r) => r.job.status === 'running' && r.job.checkpoint?.step >= 1);
    process.kill(mid.job.pid, 'SIGSTOP'); // frozen for the rest of the test: it will never beat again
    offset = 3_600_000; // the wall clock jumps an hour; the monotonic clock does not — a host sleep
    const wake = await d.tick();
    expect(wake.sleep.fired).toBe(true);
    expect(wake.decisions[0]).toMatchObject({ id: 'sleeper', verdict: 'alive', action: 'leave', reason: expect.stringMatching(/sleep detected/) });
    await sleep(500);
    const soon = await d.tick(); // well inside one stale window after the wake
    expect(soon.sleep.fired).toBe(false);
    expect(soon.decisions[0]).toMatchObject({ action: 'leave' });
    const killed = await tickUntil(d, 'sleeper', (r) => r.job.timeline.some((t) => t.event === 'killed-stalled'));
    expect(killed.job.attempts).toBeGreaterThanOrEqual(1);
  }, 30_000);
});

describe('the handle probe uses the real ps', () => {
  it('a live pid with the recorded start is alive; with another start time it is refused as reused', () => {
    const h = handleOf(process.pid);
    expect(probeHandle(h)).toBe('alive');
    const { host, pid } = parseHandle(h);
    expect(probeHandle(formatHandle({ host, pid, procStart: 'Thu Jan  1 00:00:00 1970' }))).toBe('reused');
    expect(probeHandle(formatHandle({ host: 'some-other-host', pid, procStart: 'x' }))).toBe('foreign');
  });

  it('an exited process is dead', () => {
    const r = spawnSync(process.execPath, ['-e', 'console.log(process.pid)'], { encoding: 'utf8' });
    const pid = Number(r.stdout.trim());
    expect(readProcStart(pid)).toBeNull();
  });

  it('killStalledJob never signals a pid whose start time no longer matches', async () => {
    const h = handleOf(process.pid);
    const { host, pid } = parseHandle(h);
    const sent = [];
    const out = await killStalledJob(formatHandle({ host, pid, procStart: 'Thu Jan  1 00:00:00 1970' }), { signal: (p, s) => sent.push(s) });
    expect(out.gone).toBe(true);
    expect(sent).toEqual([]);
  });
});

describe('the runner fences a stale attempt', () => {
  /** A record the daemon has claimed for attempt 1 — the runner is then started by hand, not by a tick. */
  function prepare(root, input) {
    const d = mkDaemon(root);
    d.enqueue({ id: 'fence', kind: 'noop-test', codeSha: SHA, input });
    d.store.update('fence', (c) => withJob(c, { status: 'launching', attempts: 1, launchedAt: new Date().toISOString() }));
    return { store: openJobStore(d.store.dir), dir: d.store.dir };
  }
  function runRunner(dir, attempt) {
    const child = spawn(process.execPath, [RUNNER, `--dir=${dir}`, '--id=fence', `--attempt=${attempt}`], {
      cwd: REPO_ROOT, env: { ...process.env, DAEMON_JOB_HEARTBEAT_MS: '100' }, stdio: 'ignore',
    });
    pids.add(child.pid);
    return new Promise((res) => child.on('exit', (code) => res(code)));
  }

  it('a runner for an attempt the record has moved past exits without running', async () => {
    const root = mkTmp('dj-root-');
    const traceFile = join(root, 'trace.jsonl');
    const { dir } = prepare(root, { steps: 1, stepMs: 10, traceFile });
    expect(await runRunner(dir, 2)).toBe(0);
    expect(traceEvents(traceFile)).toEqual([]);
  }, 20_000);

  it('a running child whose record gets another handle exits at its next heartbeat', async () => {
    const root = mkTmp('dj-root-');
    const { store, dir } = prepare(root, { steps: 100, stepMs: 200 });
    const exit = runRunner(dir, 1);
    await waitRecord(store, 'fence', (r) => r.job.status === 'running');
    store.update('fence', (c) => withJob(c, { handle: formatHandle({ host: 'elsewhere', pid: 1, procStart: 'Thu Jan  1 00:00:00 1970' }) }));
    expect(await exit).toBe(3);
  }, 20_000);
});

describe('mutates-tree: the child holds the clone\'s shared hold only while it runs', () => {
  it('a reader entry exists for the job while it runs and is gone after', async () => {
    const root = mkTmp('dj-root-');
    const lockRoot = mkTmp('dj-locks-');
    const clone = mkTmp('dj-clone-');
    const d = mkDaemon(root, { cloneRoot: clone, env: { WE_DAEMON_CLONE_LOCK_ROOT: lockRoot } });
    d.enqueue({ id: 'writer-job', kind: 'noop-mutates', codeSha: SHA, input: { steps: 4, stepMs: 200 } });
    const readers = () => {
      const base = readdirSync(lockRoot).map((k) => join(lockRoot, k, 'readers')).filter(existsSync);
      return base.flatMap((r) => readdirSync(r));
    };
    const running = await tickUntil(d, 'writer-job', (r) => r.job.status === 'running' && r.job.checkpoint?.step >= 1);
    expect(readers()).toHaveLength(1);
    expect(running.job.codeMode).toBe('mutates-tree');
    await tickUntil(d, 'writer-job', (r) => r.job.status === 'succeeded');
    expect(readers()).toHaveLength(0);
  }, 30_000);
});
