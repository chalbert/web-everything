/**
 * @file scripts/lib/daemon-job-kinds/noop.mjs
 * @description #4125 — the NO-OP TEST JOB KIND: the job the live proofs (`../daemon-jobs-proof.mjs`) and the
 * runner tests run. It does nothing but walk `input.steps` steps of `input.stepMs` each, checkpointing after
 * every one, and append one line per event to `input.traceFile` — so a proof can count, from outside the job
 * record, how many times the job STARTED and how many times it FINISHED.
 *
 * input: { steps = 3, stepMs = 1000, traceFile? }
 */

import { appendFileSync } from 'node:fs';

function trace(file, event, extra = {}) {
  if (!file) return;
  appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), pid: process.pid, event, ...extra })}\n`);
}

export async function run({ input = {}, checkpoint, saveCheckpoint, log = () => {}, attempt }) {
  const steps = Number.isInteger(input.steps) && input.steps > 0 ? input.steps : 3;
  const stepMs = Number.isFinite(input.stepMs) && input.stepMs >= 0 ? input.stepMs : 1000;
  const from = Number.isInteger(checkpoint?.step) ? checkpoint.step : 0;
  trace(input.traceFile, 'start', { attempt, from });
  for (let step = from + 1; step <= steps; step++) {
    await new Promise((r) => setTimeout(r, stepMs));
    saveCheckpoint({ step });
    log(`step ${step}/${steps}`);
  }
  trace(input.traceFile, 'finish', { attempt });
  return { steps, resumedFrom: from };
}
