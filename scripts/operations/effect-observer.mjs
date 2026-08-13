/**
 * @file scripts/operations/effect-observer.mjs
 * @description THE OTHER HALF OF THE SINK REGISTRY (#x0t9923, under epic #3029).
 *
 * A SINK STARTS WORK; AN OBSERVER CHECKS ON IT. #3073 gave an effect a way to say *"I started something that
 * outlives this run"* — `dispatch: true`, a `handle`, an optional `expectedBy` — but nothing ever asks how
 * that work is going, so a dispatched run parks and stays parked. This module is the asking half, and it is
 * shaped exactly like {@link ./effect-executor.mjs}'s sink half: a table keyed by effect TYPE, injected by the
 * caller, because only the caller knows what a `start.build` handle means.
 *
 * WHAT AN OBSERVER IS: `async (entry, ctx) => { status, result?, error? }` where `status` is one of
 * {@link OBSERVATIONS} — `running`, `succeeded` or `unresolved`. Note what is NOT in that list: any word for
 * "it failed". Two vocabularies that had one re-ran real work before the third removed it; the docblock on
 * {@link OBSERVATIONS} has the whole account, and it is the load-bearing comment in this file.
 *
 * WHAT THIS DOES NOT DO, deliberately:
 *   - it ships NO concrete observer of its own. The seam is here; #3070's ruling names the host. The FIRST one
 *     arrived with the first thing that dispatches — `we:scripts/operations/dispatch-lane-io.mjs` (#3037)
 *     registers a `claude agents`-backed observer, and the waker's CLI binds it. It answers `running` or
 *     `unresolved` and never `succeeded`, for the reason {@link OBSERVATIONS} gives: the tool reports liveness,
 *     which is not an outcome.
 *   - it does not decide that overdue work is DEAD. `expectedBy` passing means "go look", not "give up" —
 *     the observer is what knows, and an `expectedBy` is an estimate rather than a deadline. A waker that
 *     fails an entry on a clock alone would kill slow-but-healthy work, which is the failure the three-bucket
 *     split in `inFlightEntries` exists to avoid.
 *   - it does not touch the world. `planObservations` is pure; `observeRun` calls injected observers and
 *     returns a new record. Persisting and advancing belong to the shell.
 *
 * PURE except {@link observeRun}, which awaits injected functions. No fs, no process, no network.
 */

import { inFlightEntries, resolveInFlight } from './effect-executor.mjs';

/**
 * What an observer may answer. Three words, and the ONE thing they have in common is that none of them asks
 * the executor to do something the model cannot express.
 *
 * TWO EARLIER VOCABULARIES WERE WRONG, both measured re-running real work (PR #1186 rounds 1-3):
 *   - `failed` collided head-on. The executor's `failed` means "the sink threw `notApplied`, nothing landed,
 *     safe to retry", so writing an observer's failure there re-dispatched the build — first on the waker's
 *     timer, then, once the waker halted, on the operator's `--resume`.
 *   - `never-started` looked like the honest home for "nothing landed", and it is — but the executor retries
 *     `failed` with no cap and no backoff, so a persistently broken dispatch (bad credentials, exhausted
 *     quota, missing binary) re-dispatched on EVERY tick: eleven builds over ten ticks, exit 0 each time.
 *
 * The lesson both times: a status is a promise about what the next caller may do, and there is no status
 * meaning "this is over and nobody should touch it". So:
 *
 *   - `running`    — still going. Ask again later. The only safe default: an observer that cannot tell must
 *                    say this, because the alternative is closing out work that is still happening.
 *   - `succeeded`  — the work ran and finished CLEANLY. Records `applied` and the run advances, which is
 *                    correct precisely because there is no bad outcome for a later step to react to.
 *   - `unresolved` — terminal for the observer, and NOT actionable by this machine. The build failed, or the
 *                    dispatch never took, or the answer is ambiguous. WRITES NOTHING: the entry stays
 *                    in-flight and is reported for a person. That is the honest state, and it costs one poll
 *                    a tick rather than one dispatch a tick.
 *
 * WHY `unresolved` COLLAPSES TWO CASES THE MODEL CANNOT TELL APART. "The build failed" and "the dispatch never
 * started" want different answers — react to the outcome, and retry respectively — and the engine can express
 * NEITHER today:
 *   - an `effect` step writes no finding (`engine.mjs`), and `reads:` is rooted at `input|findings|verdict`,
 *     so no later step can see an effect's `result`. A failing build that records `applied` advances the run
 *     past the step that exists to react to it, and the human is asked "Land it?" with nothing to indicate
 *     anything went wrong. Measured.
 *   - retrying is a RETRY POLICY — how many times, how far apart, when to stop — and nothing owns one.
 * Both are filed. Until they exist, reporting and stopping is the only answer that is not a guess.
 */
export const OBSERVATIONS = Object.freeze(['running', 'succeeded', 'unresolved']);

/**
 * How each observation lands in the run record. Only ONE of them writes: `succeeded`. `unresolved` maps to
 * nothing on purpose — see {@link OBSERVATIONS} — so there is no status for the next caller to misread.
 */
const TERMINAL_STATUS = Object.freeze({ succeeded: 'applied' });

/** Why an in-flight entry was not observed. Reported rather than thrown — one bad entry must not stop a pass. */
export const SKIPS = Object.freeze({
  NO_HANDLE: 'no-handle',
  NO_OBSERVER: 'no-observer',
});

/**
 * Record WHY an entry is unresolved, without touching its status. `observedError` is deliberately not a
 * status: nothing reads it to decide whether to retry or advance, so it cannot reopen the collision the
 * vocabulary closed. See {@link OBSERVATIONS}.
 */
function withObservation(run, key, error) {
  return {
    ...run,
    effects: run.effects.map((e) => (e.key === key ? { ...e, observedError: error, observedAt: new Date().toISOString() } : e)),
  };
}

/** Normalize an observers map (plain object or `Map`) into a lookup fn. Mirrors the executor's `sinkLookup`. */
function observerLookup(observers) {
  if (observers instanceof Map) return (type) => observers.get(type);
  if (observers && typeof observers === 'object') return (type) => observers[type];
  throw new TypeError('operations: `observers` must be an object or a Map of effect type → async fn');
}

/**
 * WHAT A PASS WOULD DO to one run, without doing any of it. PURE.
 *
 * Split so the decision is testable without an observer and without a clock: `now` and the observer table are
 * both injected, and nothing here calls anything.
 *
 * @param {object} run
 * @param {object|Map} observers - effect type → observer fn. Only its KEYS are read here.
 * @param {string|Date} [now]
 * @returns {{observe: object[], skip: Array<{key: string, type: string, reason: string}>}}
 */
export function planObservations(run, observers = {}, now = new Date()) {
  const lookup = observerLookup(observers);
  const { running, overdue, unknown } = inFlightEntries(run, now);
  const observe = [];
  const skip = [];
  // An UNKNOWN entry has no handle, so there is nothing to poll — it is reported, never guessed at. The
  // replay guard already refuses it; this makes it visible to whoever is watching the loop.
  for (const e of unknown) skip.push({ key: e.key, type: e.type, reason: SKIPS.NO_HANDLE });
  // `overdue` is observed exactly like `running`. Being past its own estimate changes what a human should be
  // told, not what the machine should ask.
  for (const e of [...running, ...overdue]) {
    if (typeof lookup(e.type) !== 'function') {
      skip.push({ key: e.key, type: e.type, reason: SKIPS.NO_OBSERVER });
      continue;
    }
    observe.push(e);
  }
  return { observe, skip };
}

/**
 * ASK the observers about one run's in-flight work and fold every terminal answer into the record.
 *
 * Returns a NEW record; persisting it and calling `advance` are the shell's job, so this stays testable with
 * no store. An observer that THROWS is reported and leaves its entry alone — a waker that dies on one bad
 * observer stops waking every other run, and the entry is still in-flight, which is the truth.
 *
 * @param {object} run
 * @param {object} opts
 * @param {object|Map} opts.observers
 * @param {string|Date} [opts.now]
 * @returns {Promise<{run: object, resolved: object[], stillRunning: string[], unresolved: object[], skipped: object[], errors: object[]}>}
 */
export async function observeRun(run, { observers = {}, now = new Date() } = {}) {
  const lookup = observerLookup(observers);
  const { observe, skip } = planObservations(run, observers, now);
  const resolved = [];
  const stillRunning = [];
  const unresolved = [];
  const errors = [];
  let current = run;

  for (const entry of observe) {
    let answer;
    try {
      answer = await lookup(entry.type)(entry, { key: entry.key, runId: run.id, type: entry.type, handle: entry.handle });
    } catch (e) {
      errors.push({ key: entry.key, type: entry.type, error: String(e?.message ?? e) });
      continue;
    }
    const status = answer && typeof answer === 'object' ? answer.status : undefined;
    if (!OBSERVATIONS.includes(status)) {
      errors.push({
        key: entry.key,
        type: entry.type,
        error: `observer returned ${JSON.stringify(status)}; expected one of ${OBSERVATIONS.join('|')}`,
      });
      continue;
    }
    if (status === 'running') { stillRunning.push(entry.key); continue; }
    // TERMINAL BUT NOT ACTIONABLE. Nothing is written — see `OBSERVATIONS` — so no caller can read a status
    // that licenses a retry or an advance. The entry stays in-flight and is reported for a person.
    if (status === 'unresolved') {
      unresolved.push({ key: entry.key, type: entry.type, error: answer.error ?? null });
      // THE REASON IS RECORDED even though the STATUS is not. An `error` string licenses nothing to any
      // caller — it is not a status, so it cannot be read as "retry me" or "advance past me" — which is why
      // keeping it does not reopen the collision this vocabulary closed. Without it the reason lives only in
      // the interval job's stdout, and is gone the moment the observer's next answer differs.
      current = withObservation(current, entry.key, answer.error ?? null);
      continue;
    }
    // `succeeded` MEANS cleanly, so an `error` alongside it is a contradiction, not extra detail. Refused
    // rather than passed through: this is the one machine-checkable invariant the contract has, and the whole
    // point of the vocabulary is that a word means one thing.
    if (answer.error != null && answer.error !== '') {
      errors.push({
        key: entry.key,
        type: entry.type,
        error: `observer answered \`succeeded\` with an error (${String(answer.error)}) — say \`unresolved\` if it did not finish cleanly`,
      });
      continue;
    }
    current = resolveInFlight(current, entry.key, {
      status: TERMINAL_STATUS[status],
      result: answer.result ?? null,
      error: answer.error ?? null,
    });
    resolved.push({ key: entry.key, type: entry.type, status, recordedAs: TERMINAL_STATUS[status] });
  }

  return { run: current, resolved, stillRunning, unresolved, skipped: skip, errors };
}

/**
 * Bind observers once, so a shell calls `watcher.observe(run)`. Nothing more than a closure, and it fails at
 * construction rather than at the first pass — same reason `createEffectExecutor` does.
 */
export function createEffectObserver({ observers } = {}) {
  observerLookup(observers);
  return {
    observe: (run, { now = new Date() } = {}) => observeRun(run, { observers, now }),
    types: () => (observers instanceof Map ? [...observers.keys()] : Object.keys(observers)).sort(),
  };
}
