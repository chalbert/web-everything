#!/usr/bin/env node
/**
 * @file scripts/lib/daemon-job-runner.mjs
 * @description #4125 (statute `#daemon-jobs`) — THE DETACHED CHILD every daemon job runs as.
 *
 *   node <workdir>/scripts/lib/daemon-job-runner.mjs --dir=<jobs dir> --id=<job id> --attempt=<n>
 *
 * Spawned by `daemon-jobs-io.mjs#launchJob` from the job's own workdir (a pinned snapshot or its own
 * worktree), so this file and the kind module it loads are the pinned code, never the daemon clone's.
 *
 *   1. CLAIM. Under the record lock: the record must still be attempt `n` in `launching`/`running` with no
 *      other handle — else this child is stale (the daemon gave up on attempt `n`) and exits without running
 *      anything. On success it writes its own `host:pid:procStart` handle and `status: running`.
 *   2. HOLD. A `mutates-tree` job takes the daemon clone's shared (read) hold for as long as it runs.
 *   3. BEAT. A heartbeat every `DAEMON_JOB_HEARTBEAT_MS` (default 10s). A beat that finds the record no longer
 *      carries this handle is FENCED: the daemon relaunched the job, so this process exits at once.
 *   4. RUN. `import(<job.module>)` and `await run({input, checkpoint, saveCheckpoint, log})`. The kind resumes
 *      from `checkpoint` (the last applied step) and calls `saveCheckpoint` after each step it applies; every
 *      step must be idempotent, since a step can apply and the process die before the checkpoint lands.
 *   5. FINISH. `succeeded` with the (small, JSON) result, or `errored` with the message — the daemon's next
 *      tick retries an errored attempt within the cap.
 */

import { realpathSync } from 'node:fs';
import { hostname } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { DEFAULT_HEARTBEAT_MS, withJob } from './daemon-jobs.mjs';
import { handleOf, openJobStore } from './daemon-jobs-io.mjs';
import { acquireRead, cloneLockDirs, releaseRead } from './daemon-clone-lock.mjs';
import { heartbeat as lockHeartbeat } from '../readiness/file-locks.mjs';

function arg(name) {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const RESULT_MAX_CHARS = 4_000;

/** Keep the result small: it lives in a record written on every heartbeat. */
function boundedResult(value) {
  if (value === undefined) return null;
  const text = JSON.stringify(value);
  if (text === undefined) return null;
  return text.length <= RESULT_MAX_CHARS ? JSON.parse(text) : { truncated: true, preview: text.slice(0, RESULT_MAX_CHARS) };
}

export async function runJob({ dir, id, attempt, env = process.env, exit = (code) => process.exit(code) }) {
  const store = openJobStore(dir);
  const pid = process.pid;
  const myHandle = handleOf(pid);
  if (!myHandle) throw new Error('daemon-job-runner: cannot read this process\'s own start time');
  const now = () => new Date().toISOString();
  const log = (msg) => process.stdout.write(`[${now()}] ${id}#${attempt} ${msg}\n`);

  // 1. CLAIM
  let stale = null;
  const claimed = store.update(id, (cur) => {
    const j = cur.job;
    if (j.attempts !== attempt) { stale = `record is at attempt ${j.attempts}`; return cur; }
    if (!['launching', 'running'].includes(j.status)) { stale = `record status is ${j.status}`; return cur; }
    if (j.handle && j.handle !== myHandle) { stale = `record carries another handle ${j.handle}`; return cur; }
    const at = now();
    return withJob(cur, { status: 'running', handle: myHandle, host: hostname(), pid, startedAt: at, heartbeatAt: at },
      { at, event: 'started', attempt, handle: myHandle, resumeFrom: j.checkpoint ?? null });
  });
  if (stale) { log(`not running: ${stale}`); return exit(0); }

  // 2. HOLD (mutates-tree only)
  const cloneRoot = claimed.job.codeMode === 'mutates-tree' ? env.DAEMON_JOB_CLONE_ROOT : null;
  const holdOwner = `${hostname()}:${pid}`;
  if (cloneRoot) {
    const deadline = Date.now() + 120_000;
    let held = acquireRead(cloneRoot, { owner: holdOwner, pid });
    while (!held.ok && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2_000));
      held = acquireRead(cloneRoot, { owner: holdOwner, pid });
    }
    if (!held.ok) {
      store.update(id, (cur) => (cur.job.handle === myHandle
        ? withJob(cur, { status: 'errored', lastError: `clone hold refused: ${held.reason}` }, { at: now(), event: 'errored', attempt, detail: 'clone hold refused' })
        : cur));
      return exit(1);
    }
  }
  const releaseHold = () => { if (cloneRoot) releaseRead(cloneRoot, { owner: holdOwner }); };

  // 3. BEAT (and fence)
  const fencedExit = () => { log('fenced: the record no longer carries this handle — exiting'); releaseHold(); exit(3); };
  const mine = (cur) => cur.job.handle === myHandle && cur.job.status === 'running';
  const beatMs = Number(env.DAEMON_JOB_HEARTBEAT_MS) > 0 ? Number(env.DAEMON_JOB_HEARTBEAT_MS) : DEFAULT_HEARTBEAT_MS;
  const beat = setInterval(() => {
    let fenced = false;
    try {
      store.update(id, (cur) => (mine(cur) ? withJob(cur, { heartbeatAt: now() }) : ((fenced = true), cur)));
      if (cloneRoot) lockHeartbeat(cloneLockDirs(cloneRoot).readersRoot, holdOwner, holdOwner, now(), pid);
    } catch (e) { log(`heartbeat write failed: ${e?.message ?? e}`); }
    if (fenced) fencedExit();
  }, beatMs);

  // 4. RUN
  let checkpoint = claimed.job.checkpoint ?? null;
  const saveCheckpoint = (value) => {
    let fenced = false;
    store.update(id, (cur) => (mine(cur)
      ? withJob(cur, { checkpoint: value, heartbeatAt: now() }, { at: now(), event: 'checkpoint', attempt, detail: JSON.stringify(value).slice(0, 200) })
      : ((fenced = true), cur)));
    if (fenced) { fencedExit(); throw new Error('fenced'); }
    checkpoint = value;
  };
  try {
    const mod = await import(pathToFileURL(resolve(process.cwd(), claimed.job.module)).href);
    if (typeof mod.run !== 'function') throw new Error(`job module ${claimed.job.module} exports no run()`);
    log(`running ${claimed.job.kind} from ${process.cwd()} (resume from ${JSON.stringify(checkpoint)})`);
    const result = await mod.run({ input: claimed.input, checkpoint, saveCheckpoint, log, attempt });
    clearInterval(beat);
    // 5. FINISH
    store.update(id, (cur) => (mine(cur)
      ? withJob(cur, { status: 'succeeded', finishedAt: now(), result: boundedResult(result), handle: null, lastError: null },
        { at: now(), event: 'succeeded', attempt, handle: myHandle })
      : cur));
    log('succeeded');
    releaseHold();
    return exit(0);
  } catch (e) {
    clearInterval(beat);
    const message = String(e?.message ?? e).slice(0, 500);
    store.update(id, (cur) => (mine(cur)
      ? withJob(cur, { status: 'errored', lastError: message }, { at: now(), event: 'errored', attempt, detail: message })
      : cur));
    log(`errored: ${message}`);
    releaseHold();
    return exit(1);
  }
}

// Realpaths on both sides: the workdir often sits under a symlink (`/var` → `/private/var` on macOS, or a
// symlinked `~/.claude`), and `import.meta.url` is always the resolved path — a plain compare silently ran nothing.
function isEntryPoint() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}
const invokedDirectly = isEntryPoint();
if (invokedDirectly) {
  const dir = arg('dir');
  const id = arg('id');
  const attempt = Number(arg('attempt'));
  if (!dir || !id || !Number.isInteger(attempt) || attempt < 1) {
    process.stderr.write('usage: daemon-job-runner.mjs --dir=<jobs dir> --id=<job id> --attempt=<n>\n');
    process.exit(2);
  }
  runJob({ dir: resolve(dir), id, attempt }).catch((e) => {
    process.stderr.write(`daemon-job-runner: ${e?.stack ?? e}\n`);
    process.exit(1);
  });
}

