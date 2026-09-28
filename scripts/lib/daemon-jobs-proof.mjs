#!/usr/bin/env node
/**
 * @file scripts/lib/daemon-jobs-proof.mjs
 * @description #4125 — THE LIVE PROOFS of the daemon job model, against real processes and a real pinned
 * snapshot. Not a unit test: it takes a minute, spawns a real daemon process and kills it for real.
 *
 *   node scripts/lib/daemon-jobs-proof.mjs run --scenario=kill-daemon   # kill -9 the DAEMON mid-job, restart it
 *   node scripts/lib/daemon-jobs-proof.mjs run --scenario=sigstop       # freeze the JOB, see it killed + relaunched once
 *   node scripts/lib/daemon-jobs-proof.mjs daemon --root=… --repo=…    # the proof daemon itself (spawned by `run`)
 *
 * `run` builds a throwaway git repo holding a copy of this checkout's `scripts/` and lockfile, so the job runs
 * from a real `git archive` snapshot of a real commit (the `readonly-tree` path) — including code not yet on
 * `main`. It prints a merged timeline (proof actions, the job record's own timeline, and the no-op job's
 * start/finish trace) and exits non-zero if the scenario's invariant does not hold. Everything lives under a
 * `mkdtemp` dir (kept, and printed, for inspection); nothing under `~/.claude` is touched.
 *
 * `kill-daemon` asserts: the job finished once and was started once (one `start`, one `finish`, attempts = 1).
 * `sigstop` asserts: exactly one `killed-stalled`, two `start`s (the second resumed from the checkpoint), one
 * `finish`, attempts = 2.
 */

import { spawn, spawnSync } from 'node:child_process';
import { closeSync, cpSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJobDaemon, openJobStore, daemonJobPaths, readProcStart } from './daemon-jobs-io.mjs';
import { createWorkdirs, resolveCodeSha } from './daemon-jobs-workdir.mjs';

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), '..', '..');
const DAEMON = 'proof-daemon';
const JOB_ID = 'proof-noop';
const KINDS = { 'noop-test': { module: 'scripts/lib/daemon-job-kinds/noop.mjs', codeMode: 'readonly-tree' } };

function flag(name, fallback = null) {
  const hit = process.argv.slice(3).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString();

// ── the proof daemon ──────────────────────────────────────────────────────────────────────────────────────────

async function daemonMain() {
  const root = flag('root');
  const repo = flag('repo');
  const tickMs = Number(flag('tick-ms', '500'));
  const paths = daemonJobPaths(DAEMON, root);
  const d = createJobDaemon({
    daemon: DAEMON, kinds: KINDS, root, maxConcurrent: 2,
    ...createWorkdirs({ repoRoot: repo, paths }),
    staleMs: Number(flag('stale-ms', '120000')),
    alert: (m) => console.log(`[${stamp()}] ALERT ${m}`),
  });
  const input = { steps: Number(flag('steps', '8')), stepMs: Number(flag('step-ms', '1000')), traceFile: flag('trace') };
  // Every boot re-enqueues the same id: enqueue is idempotent, so a restart can never queue the work twice.
  const rec = d.enqueue({ id: JOB_ID, kind: 'noop-test', codeSha: resolveCodeSha(repo), input });
  console.log(`[${stamp()}] daemon pid ${process.pid} booted; job ${JOB_ID} is ${rec.job.status} (attempts ${rec.job.attempts})`);
  for (;;) {
    const s = await d.tick();
    const notable = s.decisions.filter((x) => x.action !== 'none');
    if (s.booting || s.launched.length || s.failed.length || notable.some((x) => x.action !== 'leave')) {
      console.log(`[${stamp()}] tick ${JSON.stringify({ booting: s.booting, sleep: s.sleep.fired, decisions: notable, launched: s.launched })}`);
    }
    await sleep(tickMs);
  }
}

// ── the orchestrator ──────────────────────────────────────────────────────────────────────────────────────────

function git(cwd, ...args) {
  const r = spawnSync('git', ['-c', 'user.email=proof@local', '-c', 'user.name=proof', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

/** A throwaway repo whose one commit is this checkout's scripts/ + package files, node_modules linked in. */
function buildProofRepo(base) {
  const repo = join(base, 'repo');
  mkdirSync(repo, { recursive: true });
  cpSync(join(REPO_ROOT, 'scripts'), join(repo, 'scripts'), { recursive: true, filter: (src) => !src.includes('/__tests__/') });
  for (const f of ['package.json', 'package-lock.json']) cpSync(join(REPO_ROOT, f), join(repo, f));
  writeFileSync(join(repo, '.gitignore'), 'node_modules\n');
  symlinkSync(join(REPO_ROOT, 'node_modules'), join(repo, 'node_modules'), 'dir');
  git(repo, 'init', '-q');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'proof snapshot');
  return repo;
}

async function runMain() {
  const scenario = flag('scenario', 'kill-daemon');
  if (!['kill-daemon', 'sigstop'].includes(scenario)) throw new Error(`unknown scenario ${scenario}`);
  const base = mkdtempSync(join(tmpdir(), `daemon-jobs-proof-${scenario}-`));
  const root = join(base, 'state');
  const trace = join(base, 'trace.jsonl');
  const actions = [];
  const act = (event, detail = '') => { actions.push({ at: stamp(), source: 'proof', event, detail }); console.log(`[${stamp()}] ${event} ${detail}`); };

  act('build-repo', base);
  const repo = buildProofRepo(base);
  const daemonArgs = [
    THIS_FILE, 'daemon', `--root=${root}`, `--repo=${repo}`, `--trace=${trace}`, '--tick-ms=500',
    ...(scenario === 'kill-daemon' ? ['--steps=10', '--step-ms=1000'] : ['--steps=6', '--step-ms=1000', '--stale-ms=5000']),
  ];
  const daemons = [];
  const startDaemon = (n) => {
    const fd = openSync(join(base, `daemon-${n}.log`), 'a');
    const child = spawn(process.execPath, daemonArgs, { detached: true, stdio: ['ignore', fd, fd], env: { ...process.env } });
    closeSync(fd);
    child.unref();
    daemons.push(child.pid);
    act(`start-daemon-${n}`, `pid ${child.pid}`);
    return child.pid;
  };
  const store = () => openJobStore(daemonJobPaths(DAEMON, root).jobs);
  const read = () => { try { return store().read(JOB_ID); } catch { return null; } };
  const waitFor = async (what, pred, timeoutMs = 180_000) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const rec = existsSync(daemonJobPaths(DAEMON, root).jobs) ? read() : null;
      if (rec && pred(rec)) return rec;
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}; record: ${JSON.stringify(rec?.job)}`);
      await sleep(200);
    }
  };

  let ok = false;
  try {
    const d1 = startDaemon(1);
    const mid = await waitFor('job running at step ≥ 2', (r) => r.job.status === 'running' && r.job.checkpoint?.step >= 2);
    const jobPid = mid.job.pid;
    act('job-running', `job pid ${jobPid}, checkpoint step ${mid.job.checkpoint.step}`);

    if (scenario === 'kill-daemon') {
      process.kill(d1, 'SIGKILL');
      act('kill -9 daemon', `pid ${d1}`);
      await sleep(1_500);
      act('job-still-alive?', readProcStart(jobPid) ? `yes — job pid ${jobPid} kept running without its daemon` : 'NO');
      startDaemon(2);
    } else {
      process.kill(jobPid, 'SIGSTOP');
      act('SIGSTOP job', `pid ${jobPid}`);
    }

    const done = await waitFor('job succeeded', (r) => r.job.status === 'succeeded');
    act('job-succeeded', `attempts ${done.job.attempts}`);
    await sleep(1_500); // a couple more ticks: prove nothing relaunches a finished job

    const final = read();
    const traceLines = existsSync(trace) ? readFileSync(trace, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    const starts = traceLines.filter((t) => t.event === 'start');
    const finishes = traceLines.filter((t) => t.event === 'finish');
    const killed = final.job.timeline.filter((t) => t.event === 'killed-stalled');

    const rows = [
      ...actions,
      ...final.job.timeline.map((t) => ({ at: t.at, source: 'record', event: t.event, detail: [t.attempt && `attempt ${t.attempt}`, t.handle, t.detail].filter(Boolean).join(' · ') })),
      ...traceLines.map((t) => ({ at: t.at, source: 'job', event: t.event, detail: `pid ${t.pid}${t.from !== undefined ? ` · resume from step ${t.from}` : ''}` })),
    ].sort((a, b) => a.at.localeCompare(b.at));
    console.log(`\n## Timeline — scenario ${scenario}\n`);
    console.log('| time (UTC) | source | event | detail |');
    console.log('|---|---|---|---|');
    for (const r of rows) console.log(`| ${r.at.slice(11, 23)} | ${r.source} | ${r.event} | ${String(r.detail).replace(/\|/g, '/')} |`);

    const checks = scenario === 'kill-daemon'
      ? [['started once', starts.length === 1], ['finished once', finishes.length === 1], ['one attempt', final.job.attempts === 1]]
      : [['killed as stalled once', killed.length === 1], ['started twice', starts.length === 2], ['resumed from checkpoint', (starts[1]?.from ?? 0) >= 1],
        ['finished once', finishes.length === 1], ['two attempts', final.job.attempts === 2]];
    console.log('\n## Checks\n');
    for (const [name, pass] of checks) console.log(`- ${pass ? 'PASS' : 'FAIL'} — ${name}`);
    ok = checks.every(([, pass]) => pass);
    console.log(`\nstate kept at ${base}`);
  } finally {
    for (const pid of daemons) { try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ } }
  }
  process.exit(ok ? 0 : 1);
}

const cmd = process.argv[2];
if (cmd === 'daemon') daemonMain().catch((e) => { console.error(e); process.exit(1); });
else if (cmd === 'run') runMain().catch((e) => { console.error(e); process.exit(1); });
else { console.error('usage: daemon-jobs-proof.mjs run --scenario=kill-daemon|sigstop'); process.exit(2); }
