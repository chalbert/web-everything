/**
 * @file scripts/operations/effect-executor.mjs
 * @description THE EFFECT EXECUTOR — the only thing in the engine that touches the world (#3032, epic #3029).
 *
 * An `effect` step DECLARES effects; this applies them, **keyed by run + step + ordinal**, so re-running
 * after a partial failure is safe and no caller has to hand-order two non-atomic writes. It is the
 * mechanism the statute (#operations-declared-once-callers-generated, #3031) says subsumes both the
 * *"a non-zero exit means re-run the same command"* instruction and the [#2964] write-ordering rule.
 *
 * HOW IT BEATS #2964, WHICH IS THE BAR. #2964 (resolved) is `runReviewLabelCli` splitting one logical act
 * across two `gh` calls with the UNSAFE half first: the label swap landed, then the comment carrying the
 * `reviewed-sha` marker failed, and `acceptanceCoversHead` fails OPEN on a missing marker. Its fix was to
 * REORDER the two calls by hand — the safe half first. This executor gives three guarantees, and the first
 * alone is what #2964 bought:
 *
 *   1. **Declared order is applied order.** Effects run strictly ascending by ordinal, `await`ed one at a
 *      time, and the executor HALTS at the first one that does not land. Effect N+1 is never attempted
 *      before N is `applied`. The declaration is therefore the ordering, in one readable place, instead of
 *      an ordering rule maintained by hand at every call site.
 *   2. **The half-done state is recoverable, not just avoided.** #2964's reordering still leaves the act
 *      half-done on a crash — it only chooses WHICH half. Here the run record remembers exactly which
 *      ordinals landed, so a replay finishes the act instead of restarting or abandoning it.
 *   3. **Replay never double-applies.** An `applied` entry is skipped, so the safe half is not re-posted
 *      while the unsafe half is retried.
 *
 * THE THIRD OUTCOME NOBODY WANTS TO WRITE DOWN: INDETERMINATE. A sink that throws may still have written.
 * So the executor marks an entry `pending` BEFORE calling the sink and only marks it `applied` after; an
 * entry left `pending` is an attempt whose outcome is unknown. On replay such an entry is:
 *   - **re-applied** when the effect declared `idempotent: true` (re-doing it is harmless by construction), or
 *   - **REFUSED** otherwise — the run stops and a person decides, which is the fail-closed answer. Guessing
 *     here is how you double-post a comment or double-merge a PR.
 * A sink that KNOWS nothing landed says so by throwing an error built with {@link notApplied}; that entry is
 * marked `failed` and is retried on the next pass.
 *
 * THE LEDGER SEAM — deliberately empty here. {@link LEDGER_EFFECT_TYPE} is the reserved effect type the
 * **verdict ledger** (#3007, still **open**) lands behind: an append-only JSONL keyed by PR + diff
 * content-hash, single-writer via the drain lease, and the durable merge authority. This executor SHIPS NO
 * SINK FOR IT and owns no durable outcome store of its own — it only routes to a sink the caller registers.
 * That is the producer→store relationship: the run record is the transient working state, the ledger is the
 * durable authority, and #3032 must not invent a competitor to it (see the `run-record.mjs` header).
 *
 * IO: this file writes the run record through an INJECTED store handle and calls INJECTED sinks. It imports
 * no `fs` and no `child_process` itself, so the whole executor is testable with an in-memory store and stub
 * sinks — no process, no network.
 */

import { effectsForStep } from './engine.mjs';
import { assertRunRecord } from './run-record.mjs';

/**
 * The reserved effect type for an append to the #3007 verdict ledger. Named here so #3035/#3036 declare
 * against a stable string and #3007 can register the writer behind it without touching this file.
 */
export const LEDGER_EFFECT_TYPE = 'verdict-ledger.append';

/**
 * Build the error a sink throws when it is CERTAIN nothing landed (a refused connection, a pre-flight
 * validation failure, a 4xx before any write). Marks the entry `failed`, which is retried on replay —
 * unlike a bare throw, which is treated as indeterminate.
 *
 * @param {string} message
 * @param {object} [extra]
 * @returns {Error}
 */
export function notApplied(message, extra = {}) {
  return Object.assign(new Error(message), { ...extra, notApplied: true });
}

/** Normalize a sinks map (plain object or `Map`) into a lookup fn. */
function sinkLookup(sinks) {
  if (sinks instanceof Map) return (type) => sinks.get(type);
  if (sinks && typeof sinks === 'object') return (type) => sinks[type];
  throw new TypeError('operations: `sinks` must be an object or a Map of effect type → async fn');
}

/** The step whose effects are being applied, refusing anything that is not actually waiting on effects. */
function targetStepIndex(run, stepIndex) {
  if (stepIndex != null) {
    if (!Number.isInteger(stepIndex) || stepIndex < 0) throw new TypeError(`operations: invalid stepIndex ${JSON.stringify(stepIndex)}`);
    return stepIndex;
  }
  if (!run.pending || run.pending.kind !== 'effect') {
    throw new Error(
      `operations: run ${run.id} is not suspended on an effect step (${run.pending ? `pending \`${run.pending.kind}\`` : 'nothing pending'}) — ` +
      'nothing to apply. Pass an explicit `stepIndex` only if you mean to replay a step the run has moved past.',
    );
  }
  return run.pending.stepIndex;
}

/** Replace one effect entry by key, returning a new run record. */
function withEntry(run, key, patch) {
  return { ...run, effects: run.effects.map((e) => (e.key === key ? { ...e, ...patch } : e)) };
}

/**
 * APPLY THE EFFECTS a run has declared for its current (or a named) effect step.
 *
 * Persists the run record through `store` after EVERY status transition, so a crash at any point leaves a
 * record that says exactly what was attempted. Returns rather than throwing when a SINK fails — the run
 * simply stays suspended, which `advance` already refuses to move past. It THROWS only on structural
 * refusals: an unknown effect type, an indeterminate non-idempotent entry, or a run that is not waiting on
 * effects at all.
 *
 * @param {object} run - the run record.
 * @param {object} opts
 * @param {Record<string, Function>|Map<string, Function>} opts.sinks - effect type → `async (payload, ctx) => result`.
 * @param {{read: Function, write: Function}} opts.store - the run store handle (see `run-store.mjs`).
 * @param {number} [opts.stepIndex] - apply a specific step's effects instead of the pending one.
 * @returns {Promise<{run: object, applied: string[], skipped: string[], halted: (object|null), error: (Error|null)}>}
 */
export async function applyPendingEffects(run, { sinks, store, stepIndex = null } = {}) {
  assertRunRecord(run, 'run record passed to applyPendingEffects');
  if (!store || typeof store.write !== 'function') {
    throw new TypeError('operations: applyPendingEffects needs a `store` handle — the record must be durable between effects');
  }
  const lookup = sinkLookup(sinks);
  const index = targetStepIndex(run, stepIndex);
  const entries = effectsForStep(run, index);

  // ── PRE-FLIGHT: refuse the whole batch before applying ANY of it ────────────────────────────────────────
  // Discovering an unknown type after effect 0 has landed is precisely the half-done state this exists to
  // prevent, so the checks run over the entire list first.
  for (const entry of entries) {
    if (entry.status === 'applied') continue;
    if (typeof lookup(entry.type) !== 'function') {
      throw new Error(
        `operations: no sink registered for effect type ${JSON.stringify(entry.type)} (run ${run.id}, step ${index}, ordinal ${entry.index}) — refusing to apply any of this step's effects.` +
        (entry.type === LEDGER_EFFECT_TYPE
          ? ` \`${LEDGER_EFFECT_TYPE}\` is the seam for the #3007 verdict ledger, which is still open and is NOT implemented by this executor; register a sink for it.`
          : ''),
      );
    }
    if (entry.status === 'pending' && !entry.idempotent) {
      throw new Error(
        `operations: effect ${entry.key} (${entry.type}) was attempted and its outcome is UNKNOWN — it is not declared ` +
        'idempotent, so replaying it could double-apply. Refusing. Resolve it by hand (mark the entry `applied` or ' +
        '`failed` on the run record) and re-run.',
      );
    }
  }

  const applied = [];
  const skipped = [];
  let current = run;

  for (const entry of entries) {
    const live = current.effects.find((e) => e.key === entry.key);
    if (live.status === 'applied') { skipped.push(live.key); continue; }

    // Mark the attempt BEFORE making it, and persist — an entry left here is the indeterminate case above.
    current = withEntry(current, live.key, { status: 'pending', error: null });
    store.write(current);

    try {
      const result = await lookup(live.type)(live.payload, {
        key: live.key, runId: current.id, type: live.type, stepIndex: live.stepIndex, step: live.step, index: live.index,
      });
      current = withEntry(current, live.key, { status: 'applied', result: result === undefined ? null : result, error: null });
      store.write(current);
      applied.push(live.key);
    } catch (e) {
      const certainlyNotApplied = e && e.notApplied === true;
      current = withEntry(current, live.key, {
        status: certainlyNotApplied ? 'failed' : 'pending',
        error: String(e?.message ?? e),
      });
      store.write(current);
      // HALT. Effect N+1 is never attempted while N has not landed — guarantee 1 in the header.
      return { run: current, applied, skipped, halted: current.effects.find((x) => x.key === live.key), error: e };
    }
  }

  return { run: current, applied, skipped, halted: null, error: null };
}

/**
 * Bind sinks and a store once, so an adapter calls `executor.apply(run)`. Nothing more than a closure over
 * {@link applyPendingEffects}.
 *
 * @param {{sinks: (Record<string, Function>|Map<string, Function>), store: object}} config
 */
export function createEffectExecutor({ sinks, store } = {}) {
  sinkLookup(sinks); // fail at construction, not at the first apply.
  if (!store || typeof store.write !== 'function') {
    throw new TypeError('operations: createEffectExecutor needs a `store` handle');
  }
  return {
    apply: (run, { stepIndex = null } = {}) => applyPendingEffects(run, { sinks, store, stepIndex }),
    types: () => (sinks instanceof Map ? [...sinks.keys()] : Object.keys(sinks)).sort(),
  };
}
