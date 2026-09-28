#!/usr/bin/env node
/**
 * @file scripts/operations/daemon-jobs-proof/run-proof.mjs
 * @description #4125 LIVE proof of the job model, on real processes in a temp jobs folder:
 *
 *   kill9    — `kill -9` the daemon while the no-op job runs, restart it, and show the job finished once and
 *              was not started twice (the restarted daemon reattaches and leaves the live job alone).
 *   sigstop  — freeze the job with SIGSTOP, and show the daemon kills it (stale heartbeat on a live pid) and
 *              relaunches it once, resuming from its checkpoint.
 *
 *   node scripts/operations/daemon-jobs-proof/run-proof.mjs [kill9|sigstop|all]
 *
 *   Prints each scenario's record timeline, the job's side-effect lines and the daemon logs, then PASS/FAIL.
 *   Exit 0 only when every scenario passed.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, openSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJobStore, readProcStart } from '../../lib/daemon-jobs-runtime.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DAEMON = join(HERE, 'demo-daemon.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (m) => console.log(`${new Date().toISOString()} proof ${m}`);

async function waitFor(what, fn, timeoutMs = 60_000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(100);
  }
}

function startDaemon(dir, logName, extra = []) {
  const fd = openSync(join(dir, logName), 'a');
  const child = spawn(process.execPath, [DAEMON, `--dir=${dir}`, ...extra], { stdio: ['ignore', fd, fd] });
  say(`started daemon pid=${child.pid} (${logName})`);
  return child;
}

function report(dir, id, effects) {
  const rec = createJobStore(dir).read(id);
  console.log(`\n--- record timeline (${id}) ---`);
  for (const e of rec.job.timeline) {
    const { at, event, ...rest } = e;
    console.log(`${at}  ${event.padEnd(12)} ${Object.keys(rest).length ? JSON.stringify(rest) : ''}`);
  }
  console.log(`final: status=${rec.job.status} attempts=${rec.job.attempts} checkpoint=${JSON.stringify(rec.job.checkpoint.step)}`);
  console.log('\n--- side effects (one line per step actually run) ---');
  console.log(existsSync(effects) ? readFileSync(effects, 'utf8').trimEnd() : '(none)');
  return rec;
}

function printLogs(dir, names) {
  for (const n of names) {
    console.log(`\n--- ${n} ---`);
    console.log(readFileSync(join(dir, n), 'utf8').trimEnd());
  }
}

const count = (rec, event) => rec.job.timeline.filter((e) => e.event === event).length;

async function kill9() {
  const dir = mkdtempSync(join(tmpdir(), 'we-jobs-proof-kill9-'));
  const id = 'noop-kill9';
  const effects = join(dir, 'effects.log');
  const store = createJobStore(dir);
  say(`=== kill9 scenario in ${dir}`);
  const d1 = startDaemon(dir, 'daemon-1.log', [`--enqueue=${id}`, `--effects=${effects}`, '--step-ms=1500']);
  const running = await waitFor('job running', () => { const r = store.read(id); return r?.job.status === 'running' && r; });
  const jobPid = running.job.pid;
  say(`job running pid=${jobPid}; kill -9 daemon pid=${d1.pid}`);
  process.kill(d1.pid, 'SIGKILL');
  await new Promise((r) => d1.on('exit', r));
  say(`daemon gone; job pid=${jobPid} alive=${!!readProcStart(jobPid)}`);
  await sleep(700);
  const d2 = startDaemon(dir, 'daemon-2.log');
  const done = await waitFor('job succeeded', () => { const r = store.read(id); return r?.job.status === 'succeeded' && r; });
  await sleep(1500); // a few more ticks: nothing may relaunch a finished job
  d2.kill('SIGTERM');
  await new Promise((r) => d2.on('exit', r));
  const rec = report(dir, id, effects);
  printLogs(dir, ['daemon-1.log', 'daemon-2.log', `${id}.log`]);
  const lines = readFileSync(effects, 'utf8').trim().split('\n');
  const checks = {
    'launched once': count(rec, 'launched') === 1,
    'started once': count(rec, 'started') === 1,
    'finished once': count(rec, 'finished') === 1,
    'each step ran once': lines.length === 3,
    'one job process': new Set(lines.map((l) => /pid=(\d+)/.exec(l)[1])).size === 1 && lines[0].includes(`pid=${jobPid}`),
    succeeded: done.job.status === 'succeeded',
  };
  return checks;
}

async function sigstop() {
  const dir = mkdtempSync(join(tmpdir(), 'we-jobs-proof-sigstop-'));
  const id = 'noop-sigstop';
  const effects = join(dir, 'effects.log');
  const store = createJobStore(dir);
  say(`=== sigstop scenario in ${dir}`);
  const d = startDaemon(dir, 'daemon.log', [`--enqueue=${id}`, `--effects=${effects}`, '--step-ms=1500', '--stale-ms=3000', '--heartbeat-ms=500']);
  const afterFirst = await waitFor('first step applied', () => { const r = store.read(id); return r?.job.checkpoint.step >= 1 && r; });
  const frozen = afterFirst.job.pid;
  say(`job pid=${frozen} applied step 1; SIGSTOP it`);
  process.kill(frozen, 'SIGSTOP');
  const done = await waitFor('job succeeded', () => { const r = store.read(id); return r?.job.status === 'succeeded' && r; }, 90_000);
  await sleep(1500);
  d.kill('SIGTERM');
  await new Promise((r) => d.on('exit', r));
  const rec = report(dir, id, effects);
  printLogs(dir, ['daemon.log', `${id}.log`]);
  const lines = readFileSync(effects, 'utf8').trim().split('\n');
  const checks = {
    'stopped once': count(rec, 'stopped') === 1,
    'relaunched once (2 launches)': count(rec, 'launched') === 2,
    'finished once': count(rec, 'finished') === 1,
    'frozen process is gone': !readProcStart(frozen),
    'resumed from checkpoint (step 0 ran once)': lines.filter((l) => l.includes('step=0')).length === 1,
    succeeded: done.job.status === 'succeeded',
  };
  return checks;
}

const which = process.argv[2] || 'all';
const scenarios = { kill9, sigstop };
let ok = true;
for (const name of which === 'all' ? Object.keys(scenarios) : [which]) {
  const checks = await scenarios[name]();
  console.log(`\n=== ${name} checks ===`);
  for (const [k, v] of Object.entries(checks)) { console.log(`${v ? 'PASS' : 'FAIL'}  ${k}`); ok &&= v; }
}
console.log(ok ? '\nALL PASS' : '\nFAILED');
process.exit(ok ? 0 : 1);
