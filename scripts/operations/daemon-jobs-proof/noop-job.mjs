#!/usr/bin/env node
/**
 * @file scripts/operations/daemon-jobs-proof/noop-job.mjs
 * @description #4125 live proof — the no-op test job. Three idempotent steps, each waiting `input.stepMs` and
 *   appending one line to `input.effectsFile`, so the proof can count how many times each step really ran.
 *   Launched by `demo-daemon.mjs` through the job runtime, from a pinned snapshot.
 */
import { appendFileSync } from 'node:fs';

import { runJob } from '../../lib/daemon-jobs-runtime.mjs';

const step = (name) => ({
  name,
  run: async ({ input, step: i }) => {
    await new Promise((r) => setTimeout(r, input.stepMs ?? 1000));
    appendFileSync(input.effectsFile, `${new Date().toISOString()} step=${i} name=${name} pid=${process.pid}\n`);
  },
});

const out = await runJob({ steps: [step('one'), step('two'), step('three')] });
console.log(`${new Date().toISOString()} noop-job pid=${process.pid} ${JSON.stringify(out)}`);
process.exit(out.outcome === 'succeeded' ? 0 : 1);
