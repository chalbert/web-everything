#!/usr/bin/env node
/**
 * @file scripts/operations/daemon-jobs-proof/demo-daemon.mjs
 * @description #4125 live proof — a minimal daemon that runs only the job loop (`startJobLoop`): reattach at
 *   boot, then every tick. It declares one kind, `noop`, and can queue one job on start.
 *
 *   The snapshot is copied from this checkout's `scripts/` (key `--code-sha`, default `worktree-proof`)
 *   rather than `git archive`d, so the proof can run code that is not committed yet. A real daemon pins
 *   `git rev-parse HEAD` and uses the default `git archive` materializer.
 *
 *   node scripts/operations/daemon-jobs-proof/demo-daemon.mjs --dir=<jobsDir> [--enqueue=<id> --effects=<file>]
 *     [--tick-ms=500 --stale-ms=3000 --heartbeat-ms=500 --step-ms=1500 --backoff-ms=1000 --launch-grace-ms=5000]
 */
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJobStore, enqueueJob, startJobLoop } from '../../lib/daemon-jobs-runtime.mjs';
import { defineJobKind, kindRegistry } from '../../lib/daemon-jobs.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  return m ? [m[1], m[2] ?? 'true'] : [a, 'true'];
}));
const num = (k, d) => (args[k] ? Number(args[k]) : d);
const log = (msg) => console.log(`${new Date().toISOString()} daemon pid=${process.pid} ${msg}`);

if (!args.dir) { console.error('demo-daemon: --dir=<jobsDir> is required'); process.exit(2); }
const dir = resolve(args.dir);
mkdirSync(dir, { recursive: true });

const noop = defineJobKind({ kind: 'noop', entry: 'scripts/operations/daemon-jobs-proof/noop-job.mjs' });
const kinds = kindRegistry([noop]);
const store = createJobStore(dir);
const codeSha = args['code-sha'] || 'worktree-proof';

if (args.enqueue && !store.read(args.enqueue)) {
  enqueueJob({ store, kindDef: noop, id: args.enqueue, codeSha, input: { stepMs: num('step-ms', 1500), effectsFile: resolve(args.effects) } });
  log(`queued job ${args.enqueue}`);
}

const materialize = (into) => {
  cpSync(join(REPO, 'scripts'), join(into, 'scripts'), { recursive: true, filter: (src) => !src.includes('__tests__') });
};

log('boot — reattaching');
const stop = startJobLoop({
  store, kinds, maxConcurrent: 2, intervalMs: num('tick-ms', 500), staleMs: num('stale-ms', 3000),
  launchGraceMs: num('launch-grace-ms', 5000), backoffBaseMs: num('backoff-ms', 1000), heartbeatIntervalMs: num('heartbeat-ms', 500),
  snapshot: { materialize }, log,
  onTick: (r) => { for (const a of r.actions) log(`tick action ${JSON.stringify(a)}`); },
  onError: (e) => log(`tick error ${e.stack || e}`),
});
process.on('SIGTERM', () => { stop(); log('SIGTERM — clean stop (jobs keep running)'); process.exit(0); });
