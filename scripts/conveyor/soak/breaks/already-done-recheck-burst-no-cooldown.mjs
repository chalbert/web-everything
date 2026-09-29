/**
 * @file breaks/already-done-recheck-burst-no-cooldown.mjs — #xp12dod. The planner searched every stale id
 * on every tick, exhausting the shared GitHub budget even after burst attribution/concurrency was fixed.
 * Run its real CLI twice with ten stale items and a shared cache: first run must search every id, second
 * must search none. A fake gh logs argv and returns successful empty results; no live GitHub calls occur.
 */
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const FIXTURE = fileURLToPath(new URL('./fixtures/already-done-recheck-burst-no-cooldown.mjs', import.meta.url));
const COUNT = 10;

export default {
  id: 'already-done-recheck-burst-no-cooldown',
  title: 'dispatch-plan rechecks every stale item on consecutive ticks without a per-item cooldown',
  card: 'we:backlog/xp12dod',
  fixedBy: { sha: '8378e1bdadea64e2c593c7d0593d35fc15ab2469', where: 'lane/xp12dod-already-done-cooldown', paths: ['scripts/readiness/dispatch-plan.mjs', 'scripts/readiness/already-done-cache.mjs'] },
  fixPresent(root) {
    return existsSync(join(root, 'scripts/readiness/already-done-cache.mjs'));
  },
  async run({ log } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'soak-already-done-recheck-'));
    const violations = [];
    try {
      const backlogDir = join(dir, 'backlog');
      const bin = join(dir, 'bin');
      mkdirSync(backlogDir);
      mkdirSync(bin);
      const queueFile = join(dir, 'queue.json');
      const cacheFile = join(dir, 'already-done-cache.json');
      const argvLog = join(dir, 'argv.log');
      const cleared = [];
      for (let i = 0; i < COUNT; i++) {
        const num = String(8000 + i);
        const fm = {
          bornAs: `x${num}fix`, kind: 'story', size: 1, status: 'open',
          scope: [`we:scripts/fixture-${i}.mjs`], dateOpened: '2020-01-01', tags: [],
          ...(i >= COUNT / 2 ? { blockedBy: ['9999'] } : {}),
        };
        const text = Object.entries(fm).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
        writeFileSync(join(backlogDir, `${num}-fixture-${i}.md`), `---\n${text}\n---\n\n# Fixture item ${i}\n`);
        cleared.push({ num, addedAt: new Date().toISOString() });
      }
      writeFileSync(queueFile, JSON.stringify(cleared));
      writeFileSync(join(bin, 'gh'), [
        '#!/bin/sh', `printf '%s\\n' "$*" >> '${argvLog}'`, "echo '[]'", '',
      ].join('\n'));
      chmodSync(join(bin, 'gh'), 0o755);
      const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, WE_GH_THROTTLE_LOCK_ROOT: join(dir, 'throttle') };
      // Exercise the default policy regardless of the operator's local tuning.
      delete env.WE_DISPATCH_PLAN_ALREADY_DONE_NOT_DONE_COOLDOWN_MS;
      delete env.WE_DISPATCH_PLAN_ALREADY_DONE_DONE_COOLDOWN_MS;
      const countCalls = () => existsSync(argvLog)
        ? readFileSync(argvLog, 'utf8').split('\n').filter((line) => /^pr list\b/.test(line) && line.includes('--search')).length : 0;
      const counts = [];
      for (let run = 0; run < 2; run++) {
        const out = execFileSync(process.execPath, [FIXTURE, REPO_ROOT, backlogDir, queueFile, cacheFile], {
          encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env, timeout: 65_000, killSignal: 'SIGKILL',
        });
        log?.(out.trim());
        const report = JSON.parse(out.trim().split('\n').pop());
        if (!report.ok) {
          violations.push({ invariant: 'planner-threw', detail: report.error });
          return { violations };
        }
        counts.push(countCalls());
      }
      const firstRunCalls = counts[0];
      const secondRunCalls = counts[1] - counts[0];
      if (firstRunCalls !== COUNT) {
        violations.push({ invariant: 'first-run-budget', detail: `expected ${COUNT} searches, got ${firstRunCalls}` });
      }
      if (secondRunCalls > 0) {
        violations.push({ invariant: 'recheck-burst', detail: `second tick repeated ${secondRunCalls} searches inside the cooldown (first tick: ${firstRunCalls})` });
      }
      return { violations, report: { firstRunCalls, secondRunCalls } };
    } catch (e) {
      violations.push({ invariant: 'crash', detail: String(e?.stderr || e?.message || e).split('\n')[0] });
      return { violations };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  judge(report) {
    return report.violations.map((v) => `[${v.invariant}] ${v.detail}`);
  },
};
