/**
 * @file scripts/operations/host-sampler-calibrate.mjs
 * @description THE CALIBRATION HOOK (epic #3383, operator addition 2026-09-21). The daemon's episodes say how a heavy
 * command behaved under whatever concurrency HAPPENED to occur; days are needed before every concurrency level has
 * enough runs. This hook produces the same measurement ON DEMAND: it runs a FIXED reference workload (a named subset
 * of this repo's own tests, or the standards gate) solo and with k concurrent copies, each in its own throwaway
 * directory, records the same episode records tagged `calibration: true`, and prints the slowdown curve.
 *
 *   node scripts/operations/host-sampler.mjs calibrate --family=vitest --concurrency=1,2,3,4 [--reps=2] [--dry-run] [--yes]
 *
 * IT LOADS THE MACHINE, SO IT IS OPT-IN TWICE: with no `--yes` (or with `--dry-run`) it only prints the plan. It is NEVER
 * started by the sampler, the loop, launchd or a test (the tests drive {@link runCalibration} with a fake runner and
 * prove the real runner is not called without `--yes`). Calibration records go in the SAME day file as the daemon's,
 * but the rollup keeps them in their own table so they never mix with real lane traffic.
 *
 * PURE: {@link planCalibration}, {@link parseLevels}, {@link parseTimeOutput}, {@link slowdownCurve}, {@link renderPlan}.
 * {@link runCalibration} takes an injected `runner` and `prepareDir`; {@link makeRealRunner} is the IO edge.
 */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { episodeRecord } from './host-sampler-episodes.mjs';

/**
 * THE REFERENCE WORKLOADS. Fixed and named so a number measured today is comparable with one measured next month or on
 * another machine: change the argv and the `name` MUST change with it (`-v2`).
 */
export const REFERENCE_WORKLOADS = Object.freeze({
  vitest: Object.freeze({ name: 'vitest-operations-subset-v1', argv: Object.freeze(['npx', 'vitest', 'run', 'scripts/operations/__tests__', '--reporter=dot']), approxWallS: 90, note: 'the operations test directory: ~150 files, ~8 000 tests, Node + jsdom, forks pool' }),
  'check-standards': Object.freeze({ name: 'check-standards-v1', argv: Object.freeze(['node', 'scripts/check-standards.mjs']), approxWallS: 60, note: 'the repo standards gate' }),
});

export const MAX_CONCURRENCY = 8;

/** PURE. `1,2,3,4` → `[1,2,3,4]` (ascending, unique, each 1..{@link MAX_CONCURRENCY}), or null when invalid. */
export function parseLevels(text) {
  const parts = String(text ?? '').split(',').map((x) => x.trim()).filter(Boolean).map(Number);
  if (!parts.length || parts.some((n) => !Number.isInteger(n) || n < 1 || n > MAX_CONCURRENCY)) return null;
  return [...new Set(parts)].sort((a, b) => a - b);
}

/**
 * PURE. What a calibration WOULD do. Level 1 is always included (it is the solo baseline every slowdown divides by).
 * @param {{family:string, levels:number[], reps?:number}} o
 */
export function planCalibration({ family, levels, reps = 1 }) {
  const workload = REFERENCE_WORKLOADS[family];
  if (!workload) return { error: `unknown family ${JSON.stringify(family)} (known: ${Object.keys(REFERENCE_WORKLOADS).join(', ')})` };
  const lv = [...new Set([1, ...levels])].sort((a, b) => a - b);
  const steps = [];
  for (let rep = 1; rep <= reps; rep++) for (const level of lv) steps.push({ level, rep, copies: level });
  const totalRuns = steps.reduce((t, s) => t + s.copies, 0);
  return { family, workload, levels: lv, reps, steps, totalRuns, estimatedWallS: Math.round(steps.length * workload.approxWallS * 1.5), directories: Math.max(...lv) };
}

/** PURE. The plan as text (also what a dry run prints). */
export function renderPlan(p, { willRun }) {
  if (p.error) return `calibrate: ${p.error}`;
  return [
    `calibrate ${p.family}: reference workload ${p.workload.name} (${p.workload.argv.join(' ')})`,
    `  ${p.steps.length} step(s), ${p.totalRuns} run(s) in total: ${p.steps.map((s) => `${s.copies}x`).join(' ')}; ${p.directories} throwaway directories (git archive of HEAD + a node_modules symlink); ~${Math.round(p.estimatedWallS / 60)} min`,
    willRun ? '  RUNNING (--yes given): this loads the machine.' : '  DRY RUN: nothing was started. Add --yes (and drop --dry-run) to run it: it loads the machine.',
  ].join('\n');
}

/** PURE. `/usr/bin/time -l` stderr → `{realS, userS, sysS, maxRssBytes}` (macOS reports RSS in BYTES). */
export function parseTimeOutput(text) {
  const t = String(text ?? '');
  const m = /([\d.]+)\s+real\s+([\d.]+)\s+user\s+([\d.]+)\s+sys/.exec(t);
  const rss = /(\d+)\s+maximum resident set size/.exec(t);
  return m ? { realS: Number(m[1]), userS: Number(m[2]), sysS: Number(m[3]), maxRssBytes: rss ? Number(rss[1]) : null } : null;
}

const median = (l) => { const s = l.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.ceil(s.length / 2) - 1] : null; };
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

/**
 * PURE. The slowdown curve from calibration episode records: per concurrency level, the median wall time and its
 * ratio to the solo level, plus the ratio of wall-per-CPU-second (which removes any difference in work done).
 * @param {object[]} records episode records (`conc_mean` = the level, `wall_s`, `cpu_s`)
 */
export function slowdownCurve(records) {
  const levels = [...new Set(records.map((r) => Math.round(r.conc_mean)))].sort((a, b) => a - b);
  const at = (k) => records.filter((r) => Math.round(r.conc_mean) === k);
  const solo = at(1); const soloWall = median(solo.map((r) => r.wall_s)); const soloWork = median(solo.map((r) => (r.cpu_s > 0 ? r.wall_s / r.cpu_s : null)));
  return levels.map((k) => {
    const list = at(k); const w = median(list.map((r) => r.wall_s)); const pw = median(list.map((r) => (r.cpu_s > 0 ? r.wall_s / r.cpu_s : null)));
    return { concurrency: k, n: list.length, wallS: r2(w), slowdown: soloWall ? r2(w / soloWall) : null, slowdownPerWork: soloWork && pw ? r2(pw / soloWork) : null, avgCores: r2(median(list.map((r) => r.avg_cores))), peakRssBytes: Math.max(...list.map((r) => r.peak_rss_bytes ?? 0)) };
  });
}

/**
 * Run the calibration through an injected `runner`. NOTHING runs unless `yes` is true and `dryRun` is false: the
 * default is the plan. The runner starts the k copies of a step together and resolves each with its measurement.
 * @param {{family:string, levels:number[], reps?:number, yes?:boolean, dryRun?:boolean,
 *   runner:(job:{family:string, argv:string[], cwd:string, level:number, copy:number, rep:number})=>Promise<{wallS:number,userS:number,sysS:number,maxRssBytes:number|null,exitCode:number}>,
 *   prepareDir?:(i:number)=>string, cleanupDir?:(d:string)=>void, now?:()=>number, hostBusy?:()=>{busyPct:number|null, idlePct:number|null}, record?:(rec:object)=>void}} o
 */
export async function runCalibration({ family, levels, reps = 1, yes = false, dryRun = true, runner, prepareDir = (i) => `/tmp/calibration-${i}`, cleanupDir = () => {}, now = Date.now, hostBusy = () => ({ busyPct: null, idlePct: null }), record = () => {} }) {
  const plan = planCalibration({ family, levels, reps });
  if (plan.error) return { plan, ran: false, error: plan.error };
  const willRun = yes === true && dryRun !== true;
  if (!willRun) return { plan, ran: false, records: [], curve: [], text: renderPlan(plan, { willRun }) };
  const dirs = Array.from({ length: plan.directories }, (_, i) => prepareDir(i));
  const records = [];
  try {
    for (const step of plan.steps) {
      const startMs = now();
      const load = hostBusy();
      const results = await Promise.all(Array.from({ length: step.copies }, (_, copy) => runner({ family, argv: [...plan.workload.argv], cwd: dirs[copy], level: step.level, copy, rep: step.rep })));
      const endMs = now();
      results.forEach((res, copy) => {
        const wallMs = Math.round((res.wallS ?? (endMs - startMs) / 1000) * 1000);
        const st = {
          id: `cal-${family}-k${step.level}-r${step.rep}-c${copy}-${startMs}`, rootPid: 0, startMs, firstSeenMs: startMs, lastSeenMs: startMs + wallMs, family, command: plan.workload.argv.join(' '),
          lane: 'calibration', session: null, admitted: false, holder: null, waitS: null, childFamilies: {}, cpuByPid: { 0: (res.userS ?? 0) + (res.sysS ?? 0) }, cpuIntegralS: (res.userS ?? 0) + (res.sysS ?? 0),
          atStart: { others: step.level - 1, activeLanes: null, workers: null, busyPct: load.busyPct, idlePct: load.idlePct },
          peakOthers: step.level - 1, peakActiveLanes: 0, peakWorkers: 0, peakBusy: 0, peakRss: res.maxRssBytes ?? 0, peakProcs: 0, peakThreads: 0, peakCpuPct: 0,
          concIntegral: step.level * (wallMs / 1000), concDt: wallMs / 1000, samples: 1,
        };
        const rec = { ...episodeRecord(st, { endedBetween: [startMs + wallMs, startMs + wallMs], intervalS: 0, calibration: true }), exit_code: res.exitCode ?? 0, workload: plan.workload.name };
        records.push(rec); record(rec);
      });
    }
  } finally { for (const d of dirs) cleanupDir(d); }
  const curve = slowdownCurve(records);
  const text = [renderPlan(plan, { willRun }), '  concurrency  runs  wall s  slowdown  per-work  avg cores  peak RSS MB', ...curve.map((c) => `  ${String(c.concurrency).padStart(11)}  ${String(c.n).padStart(4)}  ${String(c.wallS).padStart(6)}  ${String(c.slowdown ?? '?').padStart(8)}  ${String(c.slowdownPerWork ?? '?').padStart(8)}  ${String(c.avgCores).padStart(9)}  ${Math.round(c.peakRssBytes / 1048576)}`)].join('\n');
  return { plan, ran: true, records, curve, text };
}

// ── IO EDGE (never reached from a test or from the sampler loop) ────────────────────────────────────────

/** IO. A throwaway working directory: `git archive HEAD` extracted, with the repo's `node_modules` symlinked in. */
export function prepareRealDir(repoRoot) {
  return (i) => {
    const dir = mkdtempSync(join(tmpdir(), `we-calibrate-${i}-`));
    const archive = execFileSync('git', ['archive', '--format=tar', 'HEAD'], { cwd: repoRoot, maxBuffer: 1024 * 1024 * 1024 });
    execFileSync('tar', ['-x', '-C', dir], { input: archive });
    if (existsSync(join(repoRoot, 'node_modules'))) symlinkSync(join(repoRoot, 'node_modules'), join(dir, 'node_modules'));
    mkdirSync(join(dir, '.calibration'), { recursive: true });
    return dir;
  };
}
export const cleanupRealDir = (d) => { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } };

/** IO. Run one job under `/usr/bin/time -l` so wall, user+sys CPU and peak RSS of the WHOLE tree are measured. */
export function makeRealRunner({ spawnFn = spawn } = {}) {
  return (job) => new Promise((resolveJob) => {
    const child = spawnFn('/usr/bin/time', ['-l', ...job.argv], { cwd: job.cwd, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, CI: '1' } });
    let err = '';
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => {
      const t = parseTimeOutput(err);
      resolveJob({ wallS: t?.realS ?? 0, userS: t?.userS ?? 0, sysS: t?.sysS ?? 0, maxRssBytes: t?.maxRssBytes ?? null, exitCode: code ?? 1 });
    });
  });
}
