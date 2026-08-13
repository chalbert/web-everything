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
 * THE TABLE IS INJECTED, exactly like the executor's sinks — this module knows nothing about what any handle
 * means. The CLI block at the bottom registers the ONE observer that exists today, the `claude agents`-backed
 * one that `dispatch-lane` (#3037) dispatches against; before it there was nothing in the repo to watch.
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
import { createDispatchObservers } from './dispatch-lane-io.mjs';
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
    unresolved: observed.unresolved.map((u) => ({
      ...u,
      hoursStuck: hoursStuck((run.effects || []).find((e) => e.key === u.key), now),
    })),
    skipped: observed.skipped,
    errors: [...observed.errors],
    advanced: false,
    status: null,
  };

  // PERSIST BEFORE ADVANCING. An observation is the only record that the work finished — the observer may not
  // be able to answer twice (a session's transcript is reaped, a build's log rotates), so losing it to a crash
  // during `advance` would strand the run with no way back to the answer.
  // Persist when anything changed — a resolution, or the recorded reason an entry is unresolved. The reason
  // is the only durable trace of why a run is stuck; losing it to the next tick's differing answer is the gap
  // this closes.
  if (observed.resolved.length || observed.unresolved.length) store.write(observed.run);
  let current = observed.run;

  // Nothing resolved → nothing to advance past. Say so and stop, rather than spending an `advance` that the
  // engine would return unchanged anyway.
  if (!observed.resolved.length) {
    report.status = runStatus(current, { registry });
    return report;
  }

  // No special case for a failure, and that is the fix rather than an omission: `unresolved` writes no status,
  // so there is nothing here to special-case. Three earlier vocabularies each wrote one and each got acted on
  // by some caller — the account is on `OBSERVATIONS` in `we:scripts/operations/effect-observer.mjs`.
  try {
    for (let turn = 0; turn < 64; turn += 1) {
      const status = runStatus(current, { registry });
      if (status === 'awaiting-effect') {
        // `auto`, because this is the timer. The distinction is the whole point of recording it.
        const outcome = await applyPendingEffects(current, { sinks, store, attemptedBy: 'auto' });
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
      // NOT belt-and-braces, though it was labelled that for four review rounds. It is the ONLY thing
      // catching what escapes `wakeRun`'s own try — a throwing `store.write`, a null observers table, a
      // malformed record — each of which would otherwise stop the pass for every other run.
      errors.push({ runId: id, error: String(e?.message ?? e) });
    }
  }

  return { scanned: ids.length, parked, runs, errors };
}

/**
 * How long an unresolved entry has been going, in hours, from the `startedAt` the dispatch already records.
 * No new state: the escalation the reviewer asked for needs nothing durable that is not already there.
 */
export function hoursStuck(entry, now = new Date()) {
  const started = entry?.startedAt ? Date.parse(entry.startedAt) : NaN;
  const at = now instanceof Date ? now.getTime() : Date.parse(String(now));
  if (Number.isNaN(started) || Number.isNaN(at)) return null;
  return Math.max(0, (at - started) / 3_600_000);
}

/**
 * After this many hours, an unresolved entry stops being reported and starts being ESCALATED — a non-zero
 * exit, so a supervisor watching exit codes learns something. It is a REPORTING bound, never a retry bound:
 * nothing is re-dispatched at any age. Retry is #3083 and has no owner yet.
 */
export const STUCK_ESCALATION_HOURS = 6;

/** Unresolved entries whose age has passed `hours`. PURE — the age is already on the report. */
export function stuckPast(pass, hours = STUCK_ESCALATION_HOURS) {
  return (pass.runs || []).flatMap((r) => (r.unresolved || [])
    .filter((u) => typeof u.hoursStuck === 'number' && u.hoursStuck >= hours)
    .map((u) => ({ runId: r.runId, ...u })));
}

/** One pass as operator-facing lines. PURE. Quiet when there is nothing parked — this runs on a timer. */
export function renderPass(pass) {
  if (!pass.parked && !pass.errors.length) return [`wake: ${pass.scanned} run(s) scanned, none parked on a dispatch.`];
  const lines = [`wake: ${pass.scanned} run(s) scanned, ${pass.parked} parked.`];
  for (const r of pass.runs) {
    const bits = [
      r.resolved.length ? `resolved ${r.resolved.map((x) => `${x.key}→${x.status}`).join(', ')}` : '',
      r.stillRunning.length ? `still running ${r.stillRunning.join(', ')}` : '',
      r.unresolved?.length ? `NEEDS A PERSON — terminal but not actionable: ${r.unresolved.map((x) => `${x.key}${x.error ? ` (${x.error})` : ''}`).join(', ')}`
        + ' · close it out with `resolveInFlight(run, key, { status: \'failed\' })` (nothing landed → the next'
        + ' run re-dispatches) or `{ status: \'applied\' }` (it did land) — no CLI surface yet, so a short script' : '',
      r.skipped.length ? `SKIPPED ${r.skipped.map((x) => `${x.key} (${x.reason})`).join(', ')}` : '',
      r.errors.length ? `ERRORS ${r.errors.map((x) => x.error).join(' | ')}` : '',
      r.advanced ? 'advanced' : '',
      r.status ? `now ${r.status}` : '',
    ].filter(Boolean);
    lines.push(`  ${r.runId}: ${bits.join(' · ')}`);
  }
  for (const e of pass.errors) lines.push(`  ${e.runId ?? '?'}: ERROR ${e.error}`);
  const stuck = stuckPast(pass);
  for (const u of stuck) {
    lines.push(`  ESCALATED — ${u.runId}:${u.key} has been unresolved for ${u.hoursStuck.toFixed(1)}h `
      + `(over ${STUCK_ESCALATION_HOURS}h). Nothing is being retried; this needs a person.`);
  }
  return lines;
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  // ONE OBSERVER IS REGISTERED, and it arrived with the first thing that dispatches (#3037). Until then this
  // table was empty on purpose — an observer with no work to watch is an implementation with no caller — and
  // the note here said the first real dispatch would register its observer alongside its sink. This is that.
  // Any OTHER in-flight type is still reported as `no-observer` rather than silently ignored.
  const observers = createDispatchObservers();
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
      // AN INTERVAL JOB'S EXIT CODE IS THE ONLY THING A SUPERVISOR SEES, so two things earn a non-zero one:
      // a pass that could not read a run or resolve its operation, and a run stuck unresolved past
      // `STUCK_ESCALATION_HOURS`. Before the second, a permanently unresolvable run reported at exit 0 on
      // every tick forever and nothing watching exit codes ever learned. Per-run OBSERVER errors stay at 0:
      // those are the fail-soft case, already reported, and the next pass asks again.
      process.exitCode = (pass.errors.length || stuckPast(pass, STUCK_ESCALATION_HOURS).length) ? 1 : 0;
    })
    .catch((e) => {
      writeAllSync(1, `error: ${String(e?.message ?? e)}\n`);
      process.exitCode = 1;
    });
}
