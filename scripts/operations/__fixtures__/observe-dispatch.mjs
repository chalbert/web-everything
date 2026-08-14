#!/usr/bin/env node
/**
 * @file scripts/operations/__fixtures__/observe-dispatch.mjs
 * @description A SECOND PROCESS that picks up a DISPATCH it never started (#3037's acceptance).
 *
 * The clause under test is *"the launched agent's handle is recorded on the run so the conveyor can find it
 * after a restart"*. A test that observes an in-memory record has not tested that — it has tested a function
 * call. So this is a real `node` entry point handed only a run **id** and a directory: it rehydrates the
 * record from disk, finds the handle nobody told it, asks an observer about it, and writes back whatever
 * resolved. It is the dispatch-shaped sibling of `./resume-run.mjs`.
 *
 * IT STARTS NO AGENT AND RUNS NO `claude`. Only the `claude agents --json` READ is stubbed — from
 * `FIXTURE_AGENTS` — so the observer under test is the REAL one from
 * `we:scripts/operations/dispatch-lane-io.mjs`, not a test double of it.
 *
 * Usage: `node observe-dispatch.mjs <runId>`
 *   env `OPERATION_RUNS_DIR`     — where the run record lives (required in tests).
 *   env `FIXTURE_AGENTS`         — JSON array standing in for `claude agents --json`.
 *   env `FIXTURE_OBSERVATION`    — when set, a STUB observer answers with this status instead. The real
 *                                  observer can only answer `running` / `unresolved` (liveness is not an
 *                                  outcome), so this is the only way to exercise the `succeeded` resume path
 *                                  a future outcome source would take.
 * Prints one JSON line: `{ handle, expectedBy, status, resolved, unresolved, stillRunning, effects }`.
 */

import { runStatus } from '../engine.mjs';
import { createFileRunStore } from '../run-store.mjs';
import { resolveOperation } from '../run.mjs';
import { wakeRun, isParkedOnDispatch } from '../wake.mjs';
import { createDispatchObservers } from '../dispatch-lane-io.mjs';
import { DISPATCH_EFFECT } from '../dispatch-lane.mjs';

const [runId] = process.argv.slice(2);
if (!runId) {
  process.stderr.write('observe-dispatch: needs a run id\n');
  process.exit(2);
}

const store = createFileRunStore();
// REHYDRATE — this process has never seen the run. Everything it knows comes off disk.
const run = store.read(runId);
if (!run) {
  process.stderr.write(`observe-dispatch: no run record for ${runId}\n`);
  process.exit(3);
}
if (!isParkedOnDispatch(run)) {
  process.stderr.write(`observe-dispatch: run ${runId} is not parked on a dispatch\n`);
  process.exit(4);
}

const entry = run.effects.find((e) => e.status === 'in-flight');
const stubbed = process.env.FIXTURE_OBSERVATION || '';
const observers = stubbed
  ? { [DISPATCH_EFFECT]: async () => ({ status: stubbed, result: { via: 'fixture' } }) }
  : createDispatchObservers({ listAgents: () => JSON.parse(process.env.FIXTURE_AGENTS || '[]') });

// The REGISTRY is the real one, resolved from the record's own operation name — so the child steps the run
// against the declaration the repo ships, not against whatever the parent happened to build.
const { registry } = resolveOperation(run.op);
const report = await wakeRun(run, { observers, store, registry, sinks: {} });
const after = store.read(runId);

process.stdout.write(`${JSON.stringify({
  // THE HANDLE THIS PROCESS FOUND ON DISK — the whole point of the file.
  handle: entry?.handle ?? null,
  expectedBy: entry?.expectedBy ?? null,
  lane: entry?.payload?.lane ?? null,
  promptBytes: String(entry?.payload?.prompt || '').length,
  status: runStatus(after, { registry }),
  resolved: report.resolved,
  unresolved: report.unresolved.map((u) => ({ key: u.key, error: u.error })),
  stillRunning: report.stillRunning,
  skipped: report.skipped,
  errors: report.errors,
  effects: after.effects.map((e) => ({ key: e.key, status: e.status, handle: e.handle ?? null })),
})}\n`);
