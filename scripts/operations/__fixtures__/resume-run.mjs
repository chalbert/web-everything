#!/usr/bin/env node
/**
 * @file scripts/operations/__fixtures__/resume-run.mjs
 * @description A SECOND PROCESS that picks up a run it never started (#3032's cross-surface acceptance).
 *
 * The point of the run record is that a run can be suspended on one surface and finished on another. A test
 * that resumes from an in-memory object has not tested that — it has tested a function call. So this is a
 * real `node` entry point: it is handed only a run **id** and a directory, REHYDRATES the record from disk,
 * resumes it, applies whatever effects the run declares, and writes the record back.
 *
 * It spawns nothing and reaches no network: the juror is never run here (the parent resumes the judge step
 * with a canned answer), and the "effects" are appended to a local log file so the parent can count them.
 *
 * Usage: `node resume-run.mjs <runId> [resumeJson]`
 *   env `OPERATION_RUNS_DIR`  — where the run record lives (required in tests).
 *   env `FIXTURE_EFFECT_LOG`  — a file each applied effect appends one JSON line to.
 *   env `FIXTURE_FAIL_TYPES`  — comma-separated effect types whose sink throws `notApplied` (partial-failure runs).
 * Prints one JSON line: `{ status, cursor, verdict, applied, effects }`.
 */

import { appendFileSync } from 'node:fs';

import { advance, advanceWhileRunning, runStatus } from '../engine.mjs';
import { applyPendingEffects, notApplied } from '../effect-executor.mjs';
import { createFileRunStore } from '../run-store.mjs';
import { fixtureRegistry } from './fixture-operation.mjs';

const [runId, resumeJson] = process.argv.slice(2);
if (!runId) {
  process.stderr.write('resume-run: needs a run id\n');
  process.exit(2);
}

const logPath = process.env.FIXTURE_EFFECT_LOG || '';
const failTypes = new Set((process.env.FIXTURE_FAIL_TYPES || '').split(',').map((s) => s.trim()).filter(Boolean));

/** Sinks that record rather than act — every applied effect appends exactly one line. */
function makeSink(type) {
  return async (payload, ctx) => {
    if (failTypes.has(type)) throw notApplied(`fixture sink for ${type} refused (FIXTURE_FAIL_TYPES)`);
    if (logPath) appendFileSync(logPath, `${JSON.stringify({ type, key: ctx.key, payload })}\n`);
    return { ok: true };
  };
}
const sinks = { 'comment.post': makeSink('comment.post'), 'label.swap': makeSink('label.swap') };

const registry = fixtureRegistry();
const store = createFileRunStore();

// REHYDRATE — this process has never seen the run before; everything it knows comes off disk.
let run = store.read(runId);
if (!run) {
  process.stderr.write(`resume-run: no run record for ${runId}\n`);
  process.exit(3);
}

const resume = resumeJson ? JSON.parse(resumeJson) : null;
run = advanceWhileRunning(run, { registry, resume });
store.write(run);

// Drive through any effect steps: apply, then advance. Bounded so a bug cannot spin.
for (let i = 0; i < 20 && runStatus(run, { registry }) === 'awaiting-effect'; i += 1) {
  const outcome = await applyPendingEffects(run, { sinks, store });
  run = outcome.run;
  const next = advance(run, { registry });
  if (next === run) break; // an effect did not land — the run stays suspended, which is correct.
  run = advanceWhileRunning(next, { registry });
  store.write(run);
}

process.stdout.write(`${JSON.stringify({
  status: runStatus(run, { registry }),
  cursor: run.cursor,
  verdict: run.verdict,
  effects: run.effects.map((e) => ({ key: e.key, type: e.type, status: e.status })),
})}\n`);
