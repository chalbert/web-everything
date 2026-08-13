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
 * {@link OBSERVATIONS} — `running`, `finished` or `never-started`. Note what is NOT in that list: `failed`.
 * The word means opposite things to an observer and to the executor, and the collision re-ran real work twice
 * over before it was named. {@link OBSERVATIONS} has the whole account.
 *
 * WHAT THIS DOES NOT DO, deliberately:
 *   - it ships NO concrete observer. Nothing in the repo dispatches yet, so a `claude agents`-backed observer
 *     would be an implementation with no caller. The seam is here; #3070's ruling names the host.
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
 * What an observer may answer — and NONE of these words is `failed`, which is the whole point.
 *
 * `failed` was the first vocabulary, and it collided (PR #1186 rounds 1 and 2). The EXECUTOR's `failed` means
 * *"the sink threw `notApplied`, I am CERTAIN nothing landed"* — safe to retry, so the pre-flight lets it
 * straight through to the sink. An observer saying "failed" means something else entirely, and writing the
 * second into the first's slot re-ran real work: first on the waker's timer, then — after the waker learned to
 * halt — on the operator's `--resume`, which is the only recovery the run's own output offers. Halting one
 * caller does not help when the RECORD is what is wrong.
 *
 * So the words say which thing happened, and each maps onto an existing status with no ambiguity left:
 *
 *   - `running`  — still going. Ask again later. The only non-terminal answer, and the only safe default:
 *                  an observer that cannot tell must say this, because the alternative is closing out work
 *                  that is still happening.
 *   - `finished` — the work RAN and is over. Pass or fail, that is in `result`; the EFFECT was "start the
 *                  work", and starting it is what applied. Maps to `applied`, and the run advances with the
 *                  outcome in hand, which is what a declaration reads to decide what to do about a bad build.
 *   - `never-started` — the dispatch did not take. There is no session, no build, nothing ran. That is
 *                  exactly the executor's `failed`: nothing landed, safe to retry, and retrying is correct.
 *
 * A caller that wants "it ran and it went badly" says `finished` with a failing `result`. There is no answer
 * that means "it ran and should be re-run", because re-running work that already ran is not an observation —
 * it is a retry policy, and nothing owns one.
 */
export const OBSERVATIONS = Object.freeze(['running', 'finished', 'never-started']);

/** How each terminal observation lands in the run record. See {@link OBSERVATIONS} for why. */
const TERMINAL_STATUS = Object.freeze({ finished: 'applied', 'never-started': 'failed' });

/** Why an in-flight entry was not observed. Reported rather than thrown — one bad entry must not stop a pass. */
export const SKIPS = Object.freeze({
  NO_HANDLE: 'no-handle',
  NO_OBSERVER: 'no-observer',
});

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
 * @returns {Promise<{run: object, resolved: object[], stillRunning: string[], skipped: object[], errors: object[]}>}
 */
export async function observeRun(run, { observers = {}, now = new Date() } = {}) {
  const lookup = observerLookup(observers);
  const { observe, skip } = planObservations(run, observers, now);
  const resolved = [];
  const stillRunning = [];
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
    current = resolveInFlight(current, entry.key, {
      status: TERMINAL_STATUS[status],
      result: answer.result ?? null,
      error: answer.error ?? null,
    });
    resolved.push({ key: entry.key, type: entry.type, status, recordedAs: TERMINAL_STATUS[status] });
  }

  return { run: current, resolved, stillRunning, skipped: skip, errors };
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
