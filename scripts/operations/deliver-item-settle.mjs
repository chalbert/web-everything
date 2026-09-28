/**
 * @file scripts/operations/deliver-item-settle.mjs
 * @description #4349 — THE ONE THING THE DETACHED DELIVERY WRAPPER WAS MISSING: a way to tell the run store
 * that its OWN `conveyor.dispatch-delivery-agent` effect is actually done. Before this file existed, an effect
 * the executor marked `in-flight` (`effect-executor.mjs#applyPendingEffects`) stayed that way until the
 * separate, interval-scheduled waker (`we:scripts/operations/wake.mjs`) happened to run and its liveness-only
 * observer happened to resolve it — and a dead `pid:` handle gives that observer only `unresolved`, never an
 * answer, because it never reads the wrapper's own known outcome (see `we:backlog/4349-*.md`'s own evidence).
 *
 * THIS IS THE THIN SEAM, NOT A NEW STORE. `resolveInFlight` (`effect-executor.mjs`) already IS the sanctioned
 * settle primitive — the same one `wake.mjs#closeOutEntry` (the operator's own `--resolve=` surface) calls.
 * This file adds nothing but the "reach it safely from inside `deliverItem`, which KNOWS its own outcome
 * directly and needs no liveness re-check" plumbing: find the record, confirm the entry is genuinely still
 * `in-flight` (never re-settle, never invent one), resolve it, persist it.
 *
 * WHY NOT `wake.mjs#closeOutEntry`. That function additionally asserts the dispatch handle is not still listed
 * by `claude agents --json` (`assertHandleNotLive`) — the right defence for an OPERATOR guessing at a dispatch
 * they did not run, but pointless (and actively fragile — a `claude agents` hiccup would throw) for a delivery
 * settling ITS OWN run: the wrapper does not need to ask whether it is still alive, it already knows.
 *
 * A KNOWN, NAMED, BOUNDED RACE (not fixed here — see below for why). `applyPendingEffects`'s own post-sink
 * write (`effect-executor.mjs` ~L380-383) patches the SAME in-memory run record it already holds from moments
 * earlier in the identical call, with the dispatch handle/`expectedBy` the sink just returned, and persists
 * it — all synchronously, within the SAME parent process, milliseconds after the detached child (this
 * wrapper's own eventual process) was spawned. In principle that write could race a settle this module performs
 * from inside the detached child and revert it back to `in-flight`. In practice the parent's write completes a
 * process-startup's worth of time before the child could possibly reach a settle call (loading this repo's own
 * multi-thousand-line module graph, acquiring a lane, claiming the item — all before `deliverItem` even begins
 * its first real step), so the window is not realistically reachable. Closing it for real would mean giving
 * every effect type's post-sink write in `effect-executor.mjs` compare-and-swap semantics against a fresh
 * on-disk read — a materially larger change to a file outside this item's own declared `scope:` frontmatter.
 * Named here rather than silently accepted; a hardening follow-up for that file is a separate, smaller slice.
 */

import { createFileRunStore } from './run-store.mjs';
import { resolveInFlight } from './effect-executor.mjs';

/**
 * Settle ONE run's dispatch effect from inside the process that just produced its outcome. Every failure mode
 * is a documented no-op, never a throw — the caller (`deliver-item-wrapper.mjs`) treats this as best-effort,
 * exactly like its existing `releaseClaimAndLane` — a run-store hiccup must never mask the real delivery
 * outcome.
 *
 * @param {{runId?: string, key?: string, status: 'applied'|'failed', result?: any, error?: string}} o
 *   `runId`/`key` are the two new fields threaded through the dispatch sink → detached-provider argv →
 *   `deliver-item-run.mjs` → `deliverItem`'s own `launch` (see those files' own #4349 notes). Either absent
 *   (an older caller, a test, a resumed dispatch predating this fix) is a clean no-op, never a guess.
 * @param {{store?: {read: Function, write: Function}}} [io]
 * @returns {{settled: boolean, reason?: string}}
 */
export function settleDispatchEffect({ runId, key, status, result = null, error = null } = {}, {
  store = createFileRunStore(),
} = {}) {
  if (!runId || !key) return { settled: false, reason: 'no-run-id-or-key' };
  let run;
  try {
    run = store.read(runId);
  } catch (e) {
    return { settled: false, reason: `unreadable: ${String(e?.message ?? e)}` };
  }
  if (!run) return { settled: false, reason: 'run-not-found' };
  const entry = (run.effects || []).find((e) => e.key === key);
  if (!entry) return { settled: false, reason: 'no-such-effect-key' };
  // NEVER RE-SETTLE. Already `applied`/`failed` means someone else (the waker, or an earlier call from this
  // very function) already recorded the real outcome — a second write here would either throw (resolveInFlight
  // refuses a non-in-flight entry) or, worse if that guard were ever loosened, silently overwrite a true fact
  // with a stale one. `declared`/`pending` are PRE-dispatch statuses this effect never reaches once dispatched
  // (`applyPendingEffects` writes `in-flight` before the sink ever runs) — reported distinctly so a caller can
  // tell "already settled" from "not dispatched at all" if it ever cares to.
  if (entry.status !== 'in-flight') return { settled: false, reason: `already-${entry.status}` };
  const next = resolveInFlight(run, key, { status, result, error });
  store.write(next);
  return { settled: true };
}
