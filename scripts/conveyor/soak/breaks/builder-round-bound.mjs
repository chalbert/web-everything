/** Full dry-run CLI soak: slow 90-lane collectors, three fresh rounds, no real network or shared stores. */
import { runBounded } from '../../../lib/bounded-child.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const TOOLS = fileURLToPath(new URL('./fixtures/builder-round-tools.cjs', import.meta.url));
export default {
  id: 'builder-round-bound',
  title: 'slow lane collectors are shared once per builder round and refreshed on the next round',
  card: 'we:backlog/xbrndtm-restore-builder-round-cadence.md',
  fixedBy: { sha: 'working-tree', where: 'lane-58', paths: ['scripts/lib/planning-snapshot.mjs'] },
  fixPresent: root => existsSync(join(root, 'scripts/lib/planning-snapshot.mjs')),
  async run({ root = ROOT, log } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'soak-builder-round-'));
    const violations = []; const rounds = [];
    try {
      const bin = join(dir, 'bin'); const backlog = join(dir, 'backlog');
      mkdirSync(bin); mkdirSync(backlog);
      const source = readFileSync(TOOLS, 'utf8');
      for (const name of ['node', 'gh', 'claude', 'git']) writeFileSync(join(bin, name), `#!${process.execPath}\n${source}`, { mode: 0o755 });
      const calls = join(dir, 'calls');
      writeFileSync(join(dir, 'queue.json'), '[]');
      const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, SOAK_CALLS: calls,
        WE_BACKLOG_DIR: backlog, CONVEYOR_QUEUE_FILE: join(dir, 'queue.json'),
        WE_COORDINATION_ROOT: join(dir, 'coordination'), OPERATION_RUNS_DIR: join(dir, 'runs'),
        WE_DAEMON_JOBS_ROOT: join(dir, 'jobs'), LANE_POOL_ROOT: join(dir, 'pools'),
        WE_GH_THROTTLE_LOCK_ROOT: join(dir, 'throttle'), WE_GH_ETAG_DIR: join(dir, 'etag'),
        WE_PR_SNAPSHOT_DIR: join(dir, 'prs'), WE_DISPATCH_PAUSE_FILE: join(dir, 'pause'),
        WE_DISPATCH_PLAN_ALREADY_DONE_CACHE_FILE: join(dir, 'already-done') };
      for (let round = 0; round < 3; round++) {
        writeFileSync(calls, '');
        const started = performance.now();
        const report = JSON.parse(await runBounded(process.execPath, [join(root, 'skills-src/conveyor/build-dispatch-daemon.mjs'), '--dry-run', '--json'],
          { env, cwd: dir, timeoutMs: 30000, maxBytes: 8 * 1024 * 1024 }));
        const elapsedMs = Math.round(performance.now() - started);
        // Call counts below are the hard gate; wall-clock is only a generous runaway ceiling (rounds measure ~6s, so 3x headroom
        // keeps host load from reading as a regression).
        if (elapsedMs > 20000) violations.push(`round ${round}: ${elapsedMs}ms exceeds the 20000ms runaway ceiling`);
        const rows = readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
        for (const [script, verb] of [['lane-pool.mjs', 'status'], ['lane-pool.mjs', 'list'], ['backlog.mjs', 'build-queue'], ['scope-lease-collect.mjs', '--json']]) {
          const count = rows.filter(r => r.tool === 'node' && r.script === script && r.args[0] === verb).length;
          if (count !== 1) violations.push(`${script} ${verb}: ${count} reads in round ${round}`);
        }
        if (!report.timings?.phases?.planTick || !report.timings?.tickCore?.stateReadMs) violations.push('missing per-phase timings');
        if (report.wouldDispatchNow.length) violations.push('empty fixture must not dispatch');
        rounds.push({ elapsedMs, subprocesses: rows.length, gh: rows.filter(r => r.tool === 'gh').length });
        if (violations.length) break;
      }
      log?.(JSON.stringify(rounds));
    } catch (e) { violations.push(String(e.stderr || e.stack || e)); }
    finally { rmSync(dir, { recursive: true, force: true }); }
    return { violations, rounds };
  },
  judge: report => report.violations,
};
