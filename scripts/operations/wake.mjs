#!/usr/bin/env node
/**
 * @file scripts/operations/wake.mjs
 * @description THE WAKER — one pass over every parked run (#x0t9923, ruled by #3070).
 *
 * A suspended run resumes only when someone calls `advance`, and it cannot be the session that dispatched the
 * work: that session is gone. #3070 ruled the host — a dedicated interval job that calls `advance` and nothing
 * else, the converge daemon's SHAPE rather than the converge daemon, awake-only accepted. This is that job's
 * body; scheduling it is the operator's `StartInterval`, not this file's business.
 *
 * ONE PASS, AND IT IS SAFE TO RUN AS OFTEN AS YOU LIKE. `advance`'s no-resume path returns the run unchanged,
 * so polling changes nothing until the work is actually done. That is why #3070 could rule on WHO owns the
 * schedule without costing anything: the frequency is free, the coupling was the whole question.
 *
 * WHAT ONE PASS DOES, per run:
 *   1. read it; skip anything not parked on an in-flight effect;
 *   2. ask the registered observer about each OBSERVABLE in-flight entry (`observeRun`);
 *   3. write the record back if anything resolved — before advancing, so a crash here loses no answer;
 *   4. `advance` while it makes progress, applying any effects the run reaches.
 *
 * FAIL-SOFT PER RUN, ON PURPOSE. A pass touches every parked run in the store, so one unreadable record, one
 * missing observer or one throwing observer must not stop the others — each is collected into the report and
 * the pass continues. The alternative is a waker that stops waking everything the first time one run is odd,
 * which is worse than a waker that reports and carries on.
 *
 * IT SHIPS NO OBSERVER. Nothing in the repo dispatches yet, so a concrete `claude agents`-backed observer
 * would have no work to watch. The table is injected, exactly like the executor's sinks.
 *
 * IO: reads and writes run records through an INJECTED store, and calls INJECTED observers and sinks. The CLI
 * block at the bottom is the only part that touches the real ones.
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { advance, runStatus } from './engine.mjs';
import { applyPendingEffects } from './effect-executor.mjs';
import { observeRun } from './effect-observer.mjs';
import { createFileRunStore } from './run-store.mjs';
import { resolveOperation } from './run.mjs';
import { writeAllSync } from '../lib/write-all-sync.mjs';

/**
 * Is this run parked on work someone else is doing? Cheap enough to run over every record in the store.
 * @param {object} run
 * @returns {boolean}
 */
export function isParkedOnDispatch(run) {
  return !!(run && Array.isArray(run.effects) && run.effects.some((e) => e.status === 'in-flight'));
}

/**
 * ONE PASS over one run. Returns what happened rather than printing it, so the caller renders and the tests
 * assert on values.
 *
 * @param {object} run
 * @param {object} opts
 * @param {object|Map} opts.observers
 * @param {{read: Function, write: Function}} opts.store
 * @param {object} [opts.registry]
 * @param {object|Map} [opts.sinks] - needed only if advancing reaches a further effect step.
 * @param {string|Date} [opts.now]
 * @returns {Promise<object>} `{runId, resolved, stillRunning, skipped, errors, advanced, status}`
 */
export async function wakeRun(run, { observers, store, registry, sinks = {}, now = new Date() } = {}) {
  const observed = await observeRun(run, { observers, now });
  const report = {
    runId: run.id,
    resolved: observed.resolved,
    stillRunning: observed.stillRunning,
    // Terminal for the observer, not actionable by this machine — the build failed, the dispatch never took,
    // or the answer was ambiguous. Nothing was written; a person decides. See `effect-observer.mjs`.
    unresolved: observed.unresolved,
    skipped: observed.skipped,
    errors: [...observed.errors],
    advanced: false,
    status: null,
  };

  // PERSIST BEFORE ADVANCING. An observation is the only record that the work finished — the observer may not
  // be able to answer twice (a session's transcript is reaped, a build's log rotates), so losing it to a crash
  // during `advance` would strand the run with no way back to the answer.
  if (observed.resolved.length) store.write(observed.run);
  let current = observed.run;

  // Nothing resolved → nothing to advance past. Say so and stop, rather than spending an `advance` that the
  // engine would return unchanged anyway.
  if (!observed.resolved.length) {
    report.status = runStatus(current, { registry });
    return report;
  }

  // NO SPECIAL CASE FOR A FAILURE HERE, and that is the fix rather than an omission (PR #1186 rounds 1-2).
  // The first cut let an observer's "it failed" become the executor's `failed`, whose contract is "nothing
  // landed, safe to retry" — so the next `applyPendingEffects` re-dispatched real work. The second cut halted
  // the WAKER, which left the record still lying: the operator's `--resume`, the only recovery the run's own
  // output offers, re-dispatched it instead. Halting one caller cannot fix a record that says the wrong thing.
  //
  // The vocabulary fixes it at the source. `we:scripts/operations/effect-observer.mjs` no longer has a word
  // that means both: `finished` records `applied` (the effect was "start the work", and it started; the
  // outcome rides in `result`), and `never-started` records `failed` (nothing landed, so retrying is right).
  // Both then behave correctly under every caller, including this one, with no caller-side rule to remember.
  try {
    for (let turn = 0; turn < 64; turn += 1) {
      const status = runStatus(current, { registry });
      if (status === 'awaiting-effect') {
        const outcome = await applyPendingEffects(current, { sinks, store });
        current = outcome.run;
        if (outcome.error) { report.errors.push({ key: outcome.halted?.key, error: String(outcome.error.message ?? outcome.error) }); break; }
        // Parked again on a NEW dispatch — a legitimate outcome, and the next pass picks it up.
        if (outcome.inFlight && outcome.inFlight.length) break;
        // ADVANCE, do not loop back. `applyPendingEffects` does not clear `pending` — only `advance` does — so
        // re-entering the effect branch would apply nothing and spin to the turn cap.
        current = advance(current, { registry });
        store.write(current);
        report.advanced = true;
        continue;
      }
      // Every other suspend is somebody else's stop: a confirm is owed to a person or a policy, a judge needs
      // a spawn. The waker calls `advance` and nothing else (#3070), so it hands those back untouched.
      const next = advance(current, { registry });
      if (next === current) break;
      current = next;
      store.write(current);
      report.advanced = true;
    }
  } catch (e) {
    report.errors.push({ error: String(e?.message ?? e) });
  }

  report.status = runStatus(current, { registry });
  return report;
}

/**
 * ONE PASS over every parked run in the store.
 *
 * `resolveFor` maps a run's operation name to its `{registry, sinks}` — injected so this module does not
 * import the operation table and stays testable with two lines of stub.
 *
 * @param {object} opts
 * @param {{read: Function, write: Function, list: Function}} opts.store
 * @param {object|Map} opts.observers
 * @param {(op: string) => {registry: object, sinks: object}} opts.resolveFor
 * @param {string|Date} [opts.now]
 * @returns {Promise<{scanned: number, parked: number, runs: object[], errors: object[]}>}
 */
export async function wakePass({ store, observers, resolveFor, now = new Date() } = {}) {
  // FAIL-SOFT AT THE FRONT DOOR TOO (PR #1186 review, NB-4). The header promises per-run fail-soft and the
  // scan sat outside every `try`, so a store whose `list` throws took the whole pass down. It is still a real
  // fault — the caller sees it in `errors` and the CLI exits non-zero — but it is reported in the same shape
  // as everything else rather than as an exception the caller has to know to catch.
  const runs = [];
  const errors = [];
  let parked = 0;
  let ids;
  try {
    ids = store.list();
    // A `list()` that RETURNS a non-array takes the pass down exactly as a throwing one used to — the first
    // fix wrapped the call and left the use outside it (PR #1186 round 2, NB2-2).
    if (!Array.isArray(ids)) throw new TypeError(`store.list() returned ${typeof ids}, not an array`);
  } catch (e) {
    return { scanned: 0, parked: 0, runs, errors: [{ error: String(e?.message ?? e) }] };
  }

  for (const id of ids) {
    let run;
    try { run = store.read(id); } catch (e) { errors.push({ runId: id, error: String(e?.message ?? e) }); continue; }
    if (!run || !isParkedOnDispatch(run)) continue;
    parked += 1;
    let bindings;
    try { bindings = resolveFor(run.op); } catch (e) { errors.push({ runId: id, error: String(e?.message ?? e) }); continue; }
    try {
      runs.push(await wakeRun(run, { observers, store, registry: bindings.registry, sinks: bindings.sinks, now }));
    } catch (e) {
      // Belt-and-braces: `wakeRun` catches its own, so reaching here means something structural. Still per-run.
      errors.push({ runId: id, error: String(e?.message ?? e) });
    }
  }

  return { scanned: ids.length, parked, runs, errors };
}

/** One pass as operator-facing lines. PURE. Quiet when there is nothing parked — this runs on a timer. */
export function renderPass(pass) {
  if (!pass.parked && !pass.errors.length) return [`wake: ${pass.scanned} run(s) scanned, none parked on a dispatch.`];
  const lines = [`wake: ${pass.scanned} run(s) scanned, ${pass.parked} parked.`];
  for (const r of pass.runs) {
    const bits = [
      r.resolved.length ? `resolved ${r.resolved.map((x) => `${x.key}→${x.status}`).join(', ')}` : '',
      r.stillRunning.length ? `still running ${r.stillRunning.join(', ')}` : '',
      r.unresolved?.length ? `NEEDS A PERSON — terminal but not actionable: ${r.unresolved.map((x) => `${x.key}${x.error ? ` (${x.error})` : ''}`).join(', ')}` : '',
      r.skipped.length ? `SKIPPED ${r.skipped.map((x) => `${x.key} (${x.reason})`).join(', ')}` : '',
      r.errors.length ? `ERRORS ${r.errors.map((x) => x.error).join(' | ')}` : '',
      r.advanced ? 'advanced' : '',
      r.status ? `now ${r.status}` : '',
    ].filter(Boolean);
    lines.push(`  ${r.runId}: ${bits.join(' · ')}`);
  }
  for (const e of pass.errors) lines.push(`  ${e.runId ?? '?'}: ERROR ${e.error}`);
  return lines;
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  // NO OBSERVERS ARE REGISTERED HERE, and that is the honest state: nothing in the repo dispatches yet, so
  // every in-flight entry a pass finds today is reported as `no-observer` rather than silently ignored. The
  // first real dispatch registers its observer alongside its sink.
  const observers = {};
  wakePass({
    store: createFileRunStore(),
    observers,
    resolveFor: (op) => {
      const { registry, sinks } = resolveOperation(op);
      return { registry, sinks };
    },
  })
    .then((pass) => {
      writeAllSync(1, `${renderPass(pass).join('\n')}\n`);
      // A pass that could not read a run, or could not resolve its operation, is a real fault worth a non-zero
      // exit — an interval job's exit code is the only thing a supervisor sees. Per-run observer errors are
      // NOT: those are the fail-soft case, already reported, and the next pass retries them.
      process.exitCode = pass.errors.length ? 1 : 0;
    })
    .catch((e) => {
      writeAllSync(1, `error: ${String(e?.message ?? e)}\n`);
      process.exitCode = 1;
    });
}
