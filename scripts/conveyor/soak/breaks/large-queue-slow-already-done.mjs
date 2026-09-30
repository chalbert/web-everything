/** Real CLI break: 444 cleared items and a slow, rate-limited GitHub cannot occupy the tick. */
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export default {
  id: 'large-queue-slow-already-done',
  title: 'large queue and slow/rate-limited GitHub do not block the planner or multiply calls',
  card: 'we:backlog/xbkrtik-bound-builder-planning-and-preserve-child-errors.md',
  fixedBy: { sha: 'working-tree', where: 'lane-8', paths: ['scripts/readiness/already-done-refresh.mjs'] },
  fixPresent(root) { return existsSync(join(root, 'scripts/readiness/already-done-refresh.mjs')); },
  async run({ log, root = ROOT } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'soak-large-queue-'));
    const violations = [];
    let child;
    try {
      const backlog = join(dir, 'backlog'); const bin = join(dir, 'bin');
      mkdirSync(backlog); mkdirSync(bin);
      const queue = [];
      for (let i = 0; i < 444; i++) {
        const num = String(8000 + i);
        writeFileSync(join(backlog, `${num}-fixture.md`), `---\nbornAs: x${num}fix\nkind: story\nsize: 1\nstatus: open\nscope: ["we:scripts/fixture-${i}.mjs"]\ndateOpened: 2020-01-01\n---\n# Fixture ${num}\n`);
        queue.push({ num, addedAt: '2020-01-01T00:00:00Z' });
      }
      writeFileSync(join(dir, 'queue.json'), JSON.stringify(queue));
      // Every request stays alive until AFTER the planner must have returned, then returns a rate limit.
      writeFileSync(join(bin, 'gh'), `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.SOAK_CALLS, JSON.stringify(process.argv.slice(2))+'\\n');
setTimeout(()=>{process.stderr.write('API rate limit exceeded\\n');process.exit(1)}, 2500);
`, { mode: 0o755 });
      execFileSync('git', ['init', '-q'], { cwd: dir });
      execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/soak/fixture.git'], { cwd: dir });
      const cache = join(dir, 'cache'); const callsPath = join(dir, 'calls');
      const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, CONVEYOR_QUEUE_FILE: join(dir, 'queue.json'),
        WE_DISPATCH_PLAN_ALREADY_DONE_CACHE_FILE: cache, WE_GH_THROTTLE_LOCK_ROOT: join(dir, 'throttle'),
        WE_PR_SNAPSHOT_DIR: join(dir, 'snapshot'), SOAK_CALLS: callsPath };
      const started = Date.now(); let output = ''; let stderr = '';
      child = spawn(process.execPath, [join(root, 'scripts/readiness/dispatch-plan.mjs'), '--json', `--backlog-dir=${backlog}`, '--free-lanes=1',
        '--no-drift-check', '--no-pause-check', '--no-pr-limit-check'], { cwd: dir, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', d => { output += d; }); child.stderr.on('data', d => { stderr += d; });
      const code = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} reject(new Error('planner blocked on slow GitHub')); }, 2000);
        child.on('error', reject);
        child.on('close', code => { clearTimeout(timer); resolve(code); });
      });
      const elapsedMs = Date.now() - started;
      if (code !== 0) throw new Error(`planner exit ${code}: ${stderr}`);
      const plan = JSON.parse(output);
      if (plan.groundTruth.pending !== 444) violations.push({ invariant: 'queue-exercised', detail: JSON.stringify(plan.groundTruth) });
      if (plan.groundTruth.refresh.ids.length !== 2) violations.push({ invariant: 'bounded-selection', detail: JSON.stringify(plan.groundTruth) });
      if (!existsSync(`${cache}.refresh-lock`)) violations.push({ invariant: 'not-awaited', detail: 'slow worker did not outlive planner' });
      // A second tick WHILE the first worker is alive must not add any requests.
      const second = JSON.parse(execFileSync(process.execPath, [join(root, 'scripts/readiness/dispatch-plan.mjs'), '--json', `--backlog-dir=${backlog}`, '--free-lanes=1',
        '--no-drift-check', '--no-pause-check', '--no-pr-limit-check'], { cwd: dir, env, encoding: 'utf8', timeout: 2000 }));
      if (second.groundTruth.refresh.started) violations.push({ invariant: 'single-flight', detail: 'overlapping tick started another worker' });
      const deadline = Date.now() + 18000;
      while (existsSync(`${cache}.refresh-lock`) && Date.now() < deadline) await delay(50);
      if (existsSync(`${cache}.refresh-lock`)) throw new Error('worker did not finish');
      const calls = existsSync(callsPath) ? readFileSync(callsPath, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
      if (calls.length < 1 || calls.length > 2) violations.push({ invariant: 'network-budget', detail: `${calls.length} calls` });
      if (new Set(calls.map(args => args.find(arg => arg.startsWith('search=')))).size !== calls.length) violations.push({ invariant: 'no-retry', detail: 'repeated request' });
      if (existsSync(cache)) violations.push({ invariant: 'failed-is-unknown', detail: 'failed checks cached as verdicts' });
      log?.(JSON.stringify({ elapsedMs, calls: calls.length }));
      return { violations, elapsedMs, calls: calls.length };
    } catch (e) { violations.push({ invariant: 'crash', detail: String(e.stack || e) }); return { violations }; }
    finally {
      // Reap any background enrichment before deleting its inputs, including on the pre-fix RED path.
      try { const { pid } = JSON.parse(readFileSync(join(dir, 'cache.refresh-lock'), 'utf8')); process.kill(-pid, 'SIGKILL'); } catch {}
      rmSync(dir, { recursive: true, force: true });
    }
  },
  judge(report) { return report.violations.map(v => `[${v.invariant}] ${v.detail}`); },
};
