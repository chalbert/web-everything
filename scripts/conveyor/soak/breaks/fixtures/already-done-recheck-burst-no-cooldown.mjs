#!/usr/bin/env node
/**
 * Run the real dispatch-plan CLI once against an isolated backlog, queue, and shared cooldown cache.
 * The parent break supplies PATH-faked gh and the throttle store. Report across the process boundary as JSON.
 *   node already-done-recheck-burst-no-cooldown.mjs <repoRoot> <backlogDir> <queueFile> <cacheFile>
 */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const [, , repoRoot, backlogDir, queueFile, cacheFile] = process.argv;
try {
  const out = execFileSync(process.execPath, [
    join(repoRoot, 'scripts/readiness/dispatch-plan.mjs'), '--json', `--backlog-dir=${backlogDir}`,
    '--free-lanes=1', '--no-drift-check', '--no-pause-check', '--no-pr-limit-check',
  ], {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, CONVEYOR_QUEUE_FILE: queueFile, WE_DISPATCH_PLAN_ALREADY_DONE_CACHE_FILE: cacheFile },
  });
  JSON.parse(out);
  process.stdout.write(`${JSON.stringify({ ok: true })}\n`);
} catch (e) {
  process.stdout.write(`${JSON.stringify({ ok: false, error: String(e?.message || e).split('\n')[0] })}\n`);
}
