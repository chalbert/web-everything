/**
 * @file breaks/short-job-behind-full-suite.mjs — card xkyw1x4 (epic #4075, under #3383). Live 2026-09-25: a fixer's
 * ~1-minute selected check waited behind 25-minute full suites on the heavy-admission slots, because every heavy
 * job shared ONE first-come-first-served queue (#2692) and any job could take any slot. With two slots, a second
 * full suite took the last free slot and a short check arriving a moment later waited for a whole suite.
 *
 * Fix: the FAST LANE in `we:scripts/readiness/heavy-admission.mjs` — short kinds (selected / files / standards)
 * rank only among themselves, and `WE_HEAVY_ADMISSION_FAST_SLOTS` (default 1) extra slots exist for them ON TOP of
 * the heavy cap (`slotOrderFor`; operator decision on PR #2707) — both full suites still run at once.
 *
 * SCENARIO — REAL processes, a REAL (temp) admission root, no mocks: two `heavy-admission.mjs run --kind=FULL --
 * sleep <FULL_S>` processes start (cap 2), then a short `run --kind=selected -- true` starts. GREEN: the short job
 * gets the fast slot and finishes in well under a second of queueing. RED (pre-fix): the second full suite
 * took the last slot, so the short job's wall time includes a whole full-suite hold. `CI` is cleared for the
 * children on purpose — under `CI=true` the wrapper is a pass-through and the scenario would prove nothing.
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FULL_S = 5; // each "full suite" holds its slot this long
const SHORT_BOUND_MS = 3_000; // the short job must be done well inside one full-suite hold
const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');

function runJob(cli, pool, kind, cmd, env) {
  const startedAt = Date.now();
  // Each job runs in its own (real, empty) lane-like checkout dir — the wrapper runs the command with it as cwd.
  const repo = join(pool, 'web-everything', `lane-${kind}-${startedAt}`);
  mkdirSync(repo, { recursive: true });
  return new Promise((done) => {
    const child = spawn(process.execPath, [cli, 'run', `--repo=${repo}`, '--cap=2', `--kind=${kind}`, '--', ...cmd], { env, stdio: 'ignore' });
    child.on('exit', (code) => done({ kind, code, ms: Date.now() - startedAt }));
  });
}

export default {
  id: 'short-job-behind-full-suite',
  title: 'a short heavy job (a fixer\'s selected check) waited behind full-suite runs on the heavy-admission slots',
  card: 'we:backlog/xkyw1x4 (epic #4075)',
  fixedBy: { sha: 'xkyw1x4', where: 'lane/xkyw1x4-queue-cap-fast-lane', paths: ['scripts/readiness/heavy-admission.mjs', 'scripts/readiness/heavy-queue-projection.mjs'] },
  fixPresent(root) {
    try { return /slotOrderFor/.test(readFileSync(join(root, 'scripts/readiness/heavy-admission.mjs'), 'utf8')); } catch { return false; }
  },
  async run({ log = () => {}, root = REPO_ROOT } = {}) {
    const pool = mkdtempSync(join(tmpdir(), 'soak-fast-lane-'));
    const violations = [];
    try {
      mkdirSync(join(pool, 'web-everything'), { recursive: true });
      const cli = join(root, 'scripts', 'readiness', 'heavy-admission.mjs');
      const env = { ...process.env, LANE_POOL_ROOT: pool, CI: '', WE_HEAVY_ADMISSION: 'on', WE_HEAVY_ADMISSION_HELD: '' };
      const fullA = runJob(cli, pool, 'FULL', ['sleep', String(FULL_S)], env);
      await new Promise((r) => { setTimeout(r, 400); });
      const fullB = runJob(cli, pool, 'FULL', ['sleep', String(FULL_S)], env);
      await new Promise((r) => { setTimeout(r, 400); });
      const short = await runJob(cli, pool, 'selected', ['true'], env);
      log(`short selected job took ${short.ms}ms (bound ${SHORT_BOUND_MS}ms)`);
      if (short.code !== 0) violations.push({ invariant: 'crash', detail: `short job exited ${short.code}` });
      if (short.ms > SHORT_BOUND_MS) violations.push({ invariant: 'fast-lane', detail: `short selected job took ${short.ms}ms — it waited behind a full suite (bound ${SHORT_BOUND_MS}ms)` });
      await Promise.all([fullA, fullB]);
    } finally {
      rmSync(pool, { recursive: true, force: true });
    }
    return { violations };
  },
  judge(report) {
    return report.violations.map((v) => `[${v.invariant}] ${v.detail}`);
  },
};
