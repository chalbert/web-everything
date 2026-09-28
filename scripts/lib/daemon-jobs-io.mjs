/**
 * @file scripts/lib/daemon-jobs-io.mjs
 * @description #4125 (statute `#daemon-jobs`) — THE IO SHELL of the daemon job model: where job records live,
 * the locked record store, the `host:pid:procStart` probe, the stalled-job kill, the detached launcher and the
 * reattach tick. Every decision is made by the pure core, `./daemon-jobs.mjs`; this file only acts on it.
 *
 * WHERE RECORDS LIVE (the ruling's open detail, settled here). One parent folder,
 * `~/.claude/daemon-jobs/<daemon>/` (`DAEMON_JOBS_ROOT` overrides the parent — tests, and a daemon pinning its
 * state root elsewhere), so the health daemon scans one place instead of each daemon's own state folder:
 *
 *   <root>/<daemon>/jobs/<id>.json    the job records (run records with a `job` block — the run store's shape)
 *   <root>/<daemon>/runs/             `OPERATION_RUNS_DIR` for the job's own children, so any run record a job
 *                                     writes lands under the daemon's pinned state root, never the snapshot
 *   <root>/<daemon>/logs/<id>.log     the detached child's stdout/stderr
 *   <root>/<daemon>/snapshots/<sha>/  pinned code snapshots for `readonly-tree` kinds
 *   <root>/<daemon>/stores/<hash>/    node_modules stores, keyed by lockfile hash
 *   <root>/<daemon>/worktrees/<id>/   own working trees for `mutates-tree` kinds
 *
 * Records are kept apart from the ordinary `.operations/runs/` sidecar so `pruneTerminalRuns` never sweeps a
 * live job, and a job's own children never mix their run records into the job directory.
 *
 * ONE WRITER AT A TIME PER RECORD. Both the daemon (launch, requeue, fail) and the detached child (claim,
 * heartbeat, checkpoint, finish) write the same record, so every write is a read-modify-write under
 * `withFileLock(<id>.lock)` and every daemon-side change is compare-and-set on the attempt it judged. The
 * child FENCES itself: a heartbeat that finds another handle on the record (the daemon gave up on this
 * attempt) exits the child instead of letting two attempts run.
 */

import { spawn, spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { join, resolve } from 'node:path';

import { createFileRunStore } from '../operations/run-store.mjs';
import { withFileLock } from './atomic-json-file.mjs';
import {
  BACKOFF_BASE_MS, DEFAULT_LAUNCH_GRACE_MS, DEFAULT_MAX_ATTEMPTS, DEFAULT_STALE_MS, SLEEP_GAP_THRESHOLD_MS,
  decideReattach, decideRetry, detectSleep, formatHandle, isJobRecord, isTerminalJob, isValidJobKind,
  newJobRecord, normalizeProcStart, parseHandle, judgeHandle, planAdmissions, withJob,
} from './daemon-jobs.mjs';

export const DAEMON_JOBS_ROOT_ENV = 'DAEMON_JOBS_ROOT';
/** The repo-relative path of the child entry point, resolved inside the job's workdir (snapshot or worktree). */
export const RUNNER_REL_PATH = 'scripts/lib/daemon-job-runner.mjs';

const DAEMON_NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** `DAEMON_JOBS_ROOT`, else `~/.claude/daemon-jobs`. */
export function daemonJobsRoot(env = process.env) {
  const v = env?.[DAEMON_JOBS_ROOT_ENV];
  return v && v.trim() ? resolve(v.trim()) : join(homedir(), '.claude', 'daemon-jobs');
}

/** Every path a daemon's jobs use, under its own folder of the shared parent. */
export function daemonJobPaths(daemon, root = daemonJobsRoot()) {
  if (typeof daemon !== 'string' || !DAEMON_NAME_RE.test(daemon)) {
    throw new TypeError(`daemon-jobs: invalid daemon name ${JSON.stringify(daemon)}`);
  }
  const base = join(root, daemon);
  return {
    base,
    jobs: join(base, 'jobs'),
    runs: join(base, 'runs'),
    logs: join(base, 'logs'),
    snapshots: join(base, 'snapshots'),
    stores: join(base, 'stores'),
    worktrees: join(base, 'worktrees'),
  };
}

// ── STORE ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The job record store: the run store's file shell over `jobsDir`, with every write under a per-record lock.
 * @param {string} jobsDir
 */
export function openJobStore(jobsDir, { lockTimeoutMs = 10_000 } = {}) {
  const runs = createFileRunStore(jobsDir);
  mkdirSync(jobsDir, { recursive: true });
  const locked = (id, fn) => withFileLock(join(jobsDir, `${id}.lock`), fn, { timeoutMs: lockTimeoutMs });
  return {
    dir: jobsDir,
    read: (id) => runs.read(id),
    /** Every record, with a corrupt one reported as `{id, corrupt: reason}` rather than thrown — one torn file
     *  must never stop the daemon from reattaching every other job. */
    listAll() {
      return runs.list().map((id) => {
        try { return runs.read(id); } catch (e) { return { id, corrupt: e.message }; }
      }).filter(Boolean);
    },
    /** Write `record` unless a record with its id already exists (enqueue is idempotent on id). */
    create(record) {
      return locked(record.id, () => runs.read(record.id) ?? runs.write(record));
    },
    /** Read-modify-write under the lock. `fn` returns the next record, or the same object for "no change". */
    update(id, fn) {
      return locked(id, () => {
        const cur = runs.read(id);
        if (!cur) throw new Error(`daemon-jobs: no job record ${id}`);
        const next = fn(cur);
        if (next && next !== cur) runs.write(next);
        return next ?? cur;
      });
    },
  };
}

/**
 * Queue a job. Idempotent on `id`: queuing an id that already has a record returns the existing record, so a
 * daemon restarted mid-tick can re-enqueue the same work without starting it twice.
 * @param {ReturnType<typeof openJobStore>} store
 * @param {{id:string, kind:string, daemon:string, kinds:object, codeSha?:string|null, input?:object, now?:string}} o
 */
export function enqueueJob(store, { id, kind, daemon, kinds, codeSha = null, input = {}, now = new Date().toISOString() }) {
  const spec = kinds?.[kind];
  if (!isValidJobKind(kind) || !spec) throw new Error(`daemon-jobs: unknown job kind ${JSON.stringify(kind)}`);
  const record = newJobRecord({
    id, kind, daemon, module: spec.module, codeMode: spec.codeMode, codeSha, input,
    maxAttempts: spec.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, now,
  });
  return store.create(record);
}

// ── HANDLE PROBE ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The start time of `pid` on this host (`LC_ALL=C ps -o stat= -o lstart= -p <pid>`), normalized.
 * @returns {string|null|undefined} null ⇒ no such process (or a zombie, which is finished); undefined ⇒ the
 *   probe failed and nothing can be concluded.
 */
export function readProcStart(pid, { spawnSyncFn = spawnSync } = {}) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  const r = spawnSyncFn('ps', ['-o', 'stat=', '-o', 'lstart=', '-p', String(pid)], {
    encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' }, timeout: 5_000,
  });
  if (r.error) return undefined;
  const line = normalizeProcStart(String(r.stdout ?? ''));
  if (!line) return r.status === 0 || r.status === 1 ? null : undefined;
  const sp = line.indexOf(' ');
  if (sp === -1) return undefined;
  const stat = line.slice(0, sp);
  if (stat.startsWith('Z')) return null; // exited, not yet reaped — the job is over
  return line.slice(sp + 1);
}

/** Probe a handle on this host → the pure {@link judgeHandle} verdict. */
export function probeHandle(handle, { host = hostname(), readProcStartFn = readProcStart } = {}) {
  const h = parseHandle(handle);
  if (!h) return 'invalid';
  return judgeHandle(handle, { host, procStart: h.host === host ? readProcStartFn(h.pid) : undefined });
}

/** The handle of `pid` on this host, or null when it cannot be read (the process is already gone). */
export function handleOf(pid, { host = hostname(), readProcStartFn = readProcStart } = {}) {
  const procStart = readProcStartFn(pid);
  return procStart ? formatHandle({ host, pid, procStart }) : null;
}

// ── KILL A STALLED JOB ────────────────────────────────────────────────────────────────────────────────────────

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Signal the job's process group (a detached child leads its own), falling back to the pid alone. */
function signalJob(pid, sig) {
  try { process.kill(-pid, sig); return; } catch { /* not a group leader, or already gone */ }
  try { process.kill(pid, sig); } catch { /* already gone */ }
}

/**
 * SIGTERM, wait, SIGKILL, confirm gone. The handle is re-probed before every signal, so a pid that was
 * reused in the meantime is never signalled. A stopped (SIGSTOP) process ignores SIGTERM until continued;
 * SIGKILL still ends it, which is why the escalation exists.
 * @returns {Promise<{gone:boolean, signals:string[]}>}
 */
export async function killStalledJob(handle, {
  termGraceMs = 5_000, killGraceMs = 5_000, pollMs = 100,
  probe = probeHandle, signal = signalJob, sleep = defaultSleep,
} = {}) {
  const h = parseHandle(handle);
  const signals = [];
  if (!h) return { gone: false, signals };
  const alive = () => probe(handle) === 'alive';
  const waitGone = async (ms) => {
    for (let waited = 0; waited < ms; waited += pollMs) {
      if (!alive()) return true;
      await sleep(pollMs);
    }
    return !alive();
  };
  if (!alive()) return { gone: true, signals };
  signal(h.pid, 'SIGTERM');
  signals.push('SIGTERM');
  if (await waitGone(termGraceMs)) return { gone: true, signals };
  signal(h.pid, 'SIGKILL');
  signals.push('SIGKILL');
  return { gone: await waitGone(killGraceMs), signals };
}

// ── LAUNCH ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Launch one queued job as a detached child. Three locked steps, each safe to die after:
 *   1. claim the launch (`queued → launching`, attempts + 1) — a daemon killed here leaves a handle-less
 *      `launching` record, which reattach reads as a lost launch after the grace and retries;
 *   2. prepare the workdir (pinned snapshot or own worktree) and spawn the runner from it;
 *   3. record the child's handle — unless the child already claimed the record itself.
 * The tick never waits for the child: it returns once the process exists.
 *
 * @param {{store:object, id:string, paths:object, prepareWorkdir:(record:object)=>Promise<{dir:string, storeKey?:string|null}>,
 *   env?:object, spawnFn?:Function, handleOfFn?:Function, now?:()=>string, execPath?:string}} o
 * @returns {Promise<{launched:boolean, attempt?:number, pid?:number, error?:string}>}
 */
export async function launchJob({
  store, id, paths, prepareWorkdir, env = process.env, spawnFn = spawn, handleOfFn = handleOf,
  now = () => new Date().toISOString(), execPath = process.execPath,
}) {
  const at = now();
  const claimed = store.update(id, (cur) => {
    if (cur.job.status !== 'queued') return cur;
    const attempt = cur.job.attempts + 1;
    return withJob(cur, {
      status: 'launching', attempts: attempt, launchedAt: at, handle: null, host: null, pid: null,
      startedAt: null, heartbeatAt: null, nextAttemptAt: null,
    }, { at, event: 'launch', attempt });
  });
  if (claimed.job.status !== 'launching' || claimed.job.launchedAt !== at) return { launched: false };
  const attempt = claimed.job.attempts;
  const sameAttempt = (cur) => cur.job.attempts === attempt && cur.job.status === 'launching';

  const failLaunch = (message) => {
    store.update(id, (cur) => (sameAttempt(cur)
      ? withJob(cur, { status: 'errored', lastError: message }, { at: now(), event: 'errored', attempt, detail: message })
      : cur));
    return { launched: false, attempt, error: message };
  };

  let workdir;
  try {
    workdir = await prepareWorkdir(claimed);
  } catch (e) {
    return failLaunch(`workdir: ${e?.message ?? e}`);
  }
  store.update(id, (cur) => (sameAttempt(cur) ? withJob(cur, { workdir: workdir.dir, storeKey: workdir.storeKey ?? null }) : cur));

  mkdirSync(paths.logs, { recursive: true });
  mkdirSync(paths.runs, { recursive: true });
  const logFd = openSync(join(paths.logs, `${id}.log`), 'a');
  let child;
  try {
    child = spawnFn(execPath, [join(workdir.dir, RUNNER_REL_PATH), `--dir=${store.dir}`, `--id=${id}`, `--attempt=${attempt}`], {
      cwd: workdir.dir,
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: {
        ...env,
        OPERATION_RUNS_DIR: paths.runs,
        DAEMON_JOB_ID: id,
        DAEMON_JOB_DIR: store.dir,
        ...(workdir.cloneRoot ? { DAEMON_JOB_CLONE_ROOT: workdir.cloneRoot } : {}),
      },
    });
    child.on?.('error', () => { /* surfaced by the missing handle → lost-launch path */ });
    child.unref?.();
  } catch (e) {
    return failLaunch(`spawn: ${e?.message ?? e}`);
  } finally {
    closeSync(logFd);
  }
  if (!Number.isInteger(child?.pid)) return failLaunch('spawn: no pid');

  const handle = handleOfFn(child.pid);
  if (handle) {
    const h = parseHandle(handle);
    store.update(id, (cur) => (sameAttempt(cur) && cur.job.handle === null
      ? withJob(cur, { handle, host: h.host, pid: h.pid })
      : cur));
  }
  return { launched: true, attempt, pid: child.pid };
}

// ── THE REATTACH TICK ─────────────────────────────────────────────────────────────────────────────────────────

/** Wall and monotonic clocks, in ms. The monotonic one does not advance while the host sleeps. */
export const systemClock = Object.freeze({
  wall: () => Date.now(),
  mono: () => Number(process.hrtime.bigint() / 1_000_000n),
});

function defaultAlert(message) {
  process.stderr.write(`[daemon-jobs] ${message}\n`);
}

/**
 * A daemon's job layer. `tick()` is the reattach step: run it once at boot and then on every daemon tick. It
 * never waits on a job — it reads records, probes handles, kills a stalled job (bounded, seconds), requeues or
 * fails finished attempts, and launches what the caps admit.
 *
 * @param {{daemon:string, kinds:Object<string, {module:string, codeMode:string, serial?:boolean,
 *   maxConcurrent?:number, maxAttempts?:number, staleMs?:number}>, maxConcurrent?:number, root?:string,
 *   prepareWorkdir:(record:object)=>Promise<object>, releaseWorkdir?:(record:object)=>void,
 *   evictStores?:(records:object[])=>void, alert?:(msg:string)=>void, clock?:{wall:()=>number, mono:()=>number},
 *   staleMs?:number, launchGraceMs?:number, sleepThresholdMs?:number, backoffBaseMs?:number, probe?:Function, killStalled?:Function,
 *   launch?:Function, env?:object}} o
 */
export function createJobDaemon({
  daemon, kinds, maxConcurrent = 2, root = daemonJobsRoot(),
  prepareWorkdir, releaseWorkdir = () => {}, evictStores = () => {},
  alert = defaultAlert, clock = systemClock,
  staleMs = DEFAULT_STALE_MS, launchGraceMs = DEFAULT_LAUNCH_GRACE_MS, sleepThresholdMs = SLEEP_GAP_THRESHOLD_MS,
  backoffBaseMs = BACKOFF_BASE_MS, probe = probeHandle, killStalled = killStalledJob, launch = launchJob, env = process.env,
}) {
  const paths = daemonJobPaths(daemon, root);
  const store = openJobStore(paths.jobs);
  let prev = null;
  let wakeAtMs = null;
  const iso = (ms) => new Date(ms).toISOString();

  /** Compare-and-set: act only if the record is still the attempt this tick judged. */
  const sameAttempt = (seen) => (cur) => cur.job.attempts === seen.job.attempts
    && cur.job.status === seen.job.status && cur.job.handle === seen.job.handle;

  function applyRetry(seen, decision, nowMs) {
    const guard = sameAttempt(seen);
    return store.update(seen.id, (cur) => {
      if (!guard(cur)) return cur;
      const at = iso(nowMs);
      if (decision.action === 'fail') {
        return withJob(cur, { status: 'failed', finishedAt: at, handle: null, lastError: decision.reason },
          { at, event: 'failed', attempt: cur.job.attempts, detail: decision.reason });
      }
      return withJob(cur, { status: 'queued', handle: null, nextAttemptAt: iso(decision.nextAttemptAt), lastError: decision.reason },
        { at, event: 'requeued', attempt: cur.job.attempts, detail: decision.reason, lastHandle: cur.job.handle ?? undefined });
    });
  }

  async function tick() {
    const cur = { wallMs: clock.wall(), monoMs: clock.mono() };
    const booting = prev === null;
    const sleep = detectSleep(prev, cur, { thresholdMs: sleepThresholdMs });
    prev = cur;
    // A boot is a wake too: the daemon cannot know how long it was gone, so every live job gets one full stale
    // window from now to beat before it can be judged stalled.
    if (booting || sleep.fired) wakeAtMs = cur.wallMs;
    if (sleep.fired) alert(`host slept ~${Math.round(sleep.sleptMs / 1000)}s; staleness check skipped this tick`);
    const nowMs = cur.wallMs;
    const summary = { booting, sleep, decisions: [], launched: [], failed: [], corrupt: [] };

    for (const rec of store.listAll()) {
      if (rec.corrupt) {
        summary.corrupt.push(rec.id);
        alert(`corrupt job record ${rec.id}: ${rec.corrupt}`);
        continue;
      }
      if (!isJobRecord(rec)) continue;
      if (isTerminalJob(rec)) {
        if (rec.job.workdir && rec.job.codeMode === 'mutates-tree') {
          try {
            releaseWorkdir(rec);
            store.update(rec.id, (c) => withJob(c, { workdir: null }, { at: iso(nowMs), event: 'workdir-released' }));
          } catch (e) { alert(`could not release workdir of ${rec.id}: ${e?.message ?? e}`); }
        }
        continue;
      }
      const verdict = rec.job.handle ? probe(rec.job.handle) : 'unknown';
      let decision = decideReattach(rec, {
        nowMs, verdict, skipStaleness: sleep.fired, wakeAtMs,
        staleMs: kinds[rec.job.kind]?.staleMs ?? staleMs, launchGraceMs, backoffBaseMs,
      });
      summary.decisions.push({ id: rec.id, verdict, ...decision });
      if (decision.action === 'kill-stalled') {
        const killed = await killStalled(rec.job.handle);
        if (!killed.gone) {
          alert(`stalled job ${rec.id} did not die after ${killed.signals.join(', ') || 'no signal'}; retrying next tick`);
          continue;
        }
        store.update(rec.id, (c) => (sameAttempt(rec)(c)
          ? withJob(c, {}, { at: iso(clock.wall()), event: 'killed-stalled', attempt: c.job.attempts, detail: `${decision.reason}; ${killed.signals.join('→')}` })
          : c));
        const after = store.read(rec.id);
        if (!sameAttempt(rec)(after)) continue; // the child finished or was relaunched while being killed
        decision = decideRetry(after, { nowMs: clock.wall(), reason: decision.reason, backoffBaseMs });
        rec.job = after.job;
      }
      if (decision.action === 'requeue' || decision.action === 'fail') {
        const next = applyRetry(rec, decision, clock.wall());
        if (next.job.status === 'failed') {
          summary.failed.push(rec.id);
          alert(`job ${rec.id} (${rec.job.kind}) FAILED: ${decision.reason}`);
        }
      }
    }

    const records = store.listAll().filter((r) => !r.corrupt);
    const plan = planAdmissions(records, { kinds, maxConcurrent, nowMs: clock.wall() });
    for (const id of plan.unknownKind) {
      const rec = records.find((r) => r.id === id);
      applyRetry(rec, { action: 'fail', reason: `unknown job kind ${rec.job.kind} — this daemon cannot run it` }, clock.wall());
      summary.failed.push(id);
      alert(`job ${id} FAILED: unknown kind ${rec.job.kind}`);
    }
    for (const id of plan.launch) {
      try {
        const r = await launch({ store, id, paths, prepareWorkdir, env });
        if (r.launched) summary.launched.push(id);
        else if (r.error) alert(`launch of ${id} failed: ${r.error}`);
      } catch (e) {
        alert(`launch of ${id} threw: ${e?.message ?? e}`);
      }
    }
    try { evictStores(store.listAll().filter((r) => !r.corrupt)); } catch (e) { alert(`store eviction failed: ${e?.message ?? e}`); }
    return summary;
  }

  return {
    paths,
    store,
    tick,
    enqueue: (spec) => enqueueJob(store, { ...spec, daemon, kinds }),
  };
}
