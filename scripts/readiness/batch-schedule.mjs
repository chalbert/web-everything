/**
 * @file scripts/readiness/batch-schedule.mjs
 * @description The ADAPTIVE execution-model selector for a batch — backlog #2334 (epic #1143).
 *
 * THE PROBLEM. `/batch` (serial) and `/workflow` (parallel) were a manual per-invocation choice of ENGINE.
 * The user picks "run these items", not "which engine"; the orchestrator should DECIDE the model from the
 * pack's real shape and MIX per batch — provably-disjoint items fan out concurrently, items that share a
 * touch-set (e.g. several PRs all editing the drain/review core — `we:scripts/merge-ai-prs.mjs`,
 * `we:scripts/pr-land.mjs`, `we:scripts/lib/review-escalation.mjs`) CHAIN so each lane rebases on the prior
 * and the drain lands them without a rebase-replay for every collision. Surfaced 2026-07-08 in
 * batch-2026-07-07-1821-2325, where 9 drain-core items were serialised BY HAND.
 *
 * EFFICIENCY, NOT CORRECTNESS — the layer distinction. `lane-partition.mjs`'s `conflicts()` is the
 * CORRECTNESS predicate: it forces same-lane ONLY for the residual git can't arbitrate (a clean-but-wrong
 * structured-registry merge, a real `blockedBy` edge, an unknown touch-set). Under the #2183 PR-fan-out
 * model "git is the arbiter" — two lanes touching one ordinary code file just cost the DRAIN a rebase, never
 * a bad merge, so correctness never needs this scheduler. What it costs is drain THRASH: N concurrent lanes
 * all editing `merge-ai-prs.mjs` ⇒ N−1 rebase-replays at drain time. This module is the EFFICIENCY layer —
 * it `contends()` on ANY real file overlap (a superset of `conflicts`) and orders contending items into
 * sequential WAVES so the drain rebases each lane onto an already-landed predecessor exactly once. A wrong
 * "parallel" call therefore only costs a drain rebase (never correctness); a wrong "chain" call only costs
 * a little wall-clock (a lane waits for a predecessor it didn't truly need). Both failure modes are cheap.
 *
 * ADAPTS AS IT PROGRESSES. The plan is not a static split. `readyAfter(entries, landed)` re-evaluates the
 * pack against the set of items that have LANDED: a pending item becomes dispatchable the moment every
 * contention-predecessor it had (a contending item ordered before it) is landed — so as items land and free
 * their files, later items free up. `scheduleWaves` is the layered view of that same relation.
 *
 * DEGENERATES CORRECTLY. Nothing contends → one wave, `all-parallel`. Every pair contends → N one-item
 * waves, `all-serial`. Anything between → `mixed`. The user picks 'batch'; this picks the model.
 *
 * PURE. No fs, no network — a probed-entry array in, a plan out. Proved by `__tests__/batch-schedule.test.mjs`.
 * Reuses the `lane-partition.mjs` primitives so the two predicates never drift.
 */
import { filesOf, mustSerialize, conflicts, disjoint, blockEdge } from './lane-partition.mjs';

/**
 * Deterministic dispatch order key. Numeric backlog NNN sorts numerically; a provisional `xNNNNNN` hash (or
 * any non-numeric id) sorts lexically AFTER all numerics, so the order is total and stable across runs.
 */
function orderKey(entry) {
  const n = Number(entry.num);
  return Number.isFinite(n) ? [0, n, ''] : [1, 0, String(entry.num)];
}

/** Compare two entries by the deterministic dispatch order (ascending num, provisional ids last). */
export function beforeInOrder(x, y) {
  const [ax, bx, cx] = orderKey(x);
  const [ay, by, cy] = orderKey(y);
  if (ax !== ay) return ax < ay;
  if (bx !== by) return bx < by;
  return cx < cy;
}

/**
 * Do two items CONTEND for the same drain slot? — the efficiency predicate (a superset of `conflicts`).
 * True when either has an unknown touch-set (a probe-less item can collide with anything — never fan it out
 * blind), or they carry a real `blockedBy` edge, or their touch-sets are clean-but-wrong entangled
 * (`conflicts`), or they simply OVERLAP on any real file. The per-item `we:backlog/NNN.md` is unique by
 * construction, so the shared backlog directory never manufactures false contention.
 */
export function contends(x, y) {
  if (mustSerialize(x) || mustSerialize(y)) return true; // unknown touch-set ⇒ never fan out blind
  if (conflicts(x, y)) return true;                      // correctness residual (blockEdge ∪ merge-risk ∪ low-conf overlap)
  return !disjoint(filesOf(x), filesOf(y));              // any real file overlap ⇒ chain to spare the drain a replay
}

/**
 * Does `item` sit inside a `blockedBy` CYCLE within `remaining`? — follows blocker edges (item → its
 * blockedBy items → their blockedBy items …) restricted to `remaining` and reports whether the walk returns
 * to `item`. Used only to break a genuinely-cyclic input deterministically: when the topo sort stalls we
 * force-emit the numerically-lowest item that is ACTUALLY in a cycle, so a non-cyclic item merely blocked BY
 * the cycle (e.g. `D` blockedBy a cyclic `A`) still keeps its satisfiable ordering constraint.
 */
function inCycle(item, remaining, blockers) {
  const self = String(item.num);
  const stack = [...blockers.get(item)];
  const seen = new Set();
  while (stack.length) {
    const n = stack.pop();
    if (n === self) return true;
    if (seen.has(n)) continue;
    seen.add(n);
    const node = remaining.find((r) => String(r.num) === n);
    if (node) for (const b of blockers.get(node)) stack.push(b);
  }
  return false;
}

/**
 * The pack in a SINGLE, globally-consistent linear order — the fix for the #259 round-2 per-pair cycle. A
 * stable topological sort (Kahn) that treats real `blockedBy` edges among IN-PACK items as the HARD constraint
 * (a blocker always precedes what it blocks, whatever its `num`) and uses the deterministic numeric
 * `beforeInOrder` ONLY as the tiebreak among items the `blockedBy` DAG leaves mutually unordered. Because every
 * pair is placed by ONE linear extension — never by an independent per-pair decision — the "contends-and-earlier"
 * predecessor relation derived from this order can never form a directed cycle. That was the bug: deciding each
 * contending pair on its own (a num-inverting `blockedBy` edge for one pair, numeric order for the rest) could
 * cycle inside a group of 3+ mutually-contending items even when the `blockedBy` data itself was perfectly
 * acyclic, so `readyAfter` returned empty and the defensive flush dumped everything into one all-parallel wave.
 *
 * GENUINELY-CYCLIC `blockedBy` DATA (a real dependency cycle in the INPUT, e.g. A→B→C→A) has no topological
 * order. Rather than silently collapse to all-parallel we break it DETERMINISTICALLY by numeric order: when no
 * item has all its in-pack blockers emitted, force-emit the numerically-lowest item that is itself in a cycle
 * (`inCycle`), then continue. The result is still one deterministic linear order — an all-serial chain in
 * numeric order among the cyclic items — never a collapse to concurrent dispatch.
 */
export function orderedEntries(entries) {
  const byNum = new Map(entries.map((e) => [String(e.num), e]));
  const blockers = new Map(entries.map((e) => [e, new Set(
    (e.blockedBy || []).map(String).filter((n) => byNum.has(n) && n !== String(e.num)),
  )]));
  const emitted = new Set();
  const order = [];
  let remaining = entries.slice();
  while (remaining.length) {
    let ready = remaining.filter((e) => [...blockers.get(e)].every((n) => emitted.has(n)));
    // Cyclic blockedBy DATA: no item is unblocked ⇒ the stuck graph contains a cycle. Break it by numeric
    // order, but only among items truly IN a cycle so items merely blocked BY the cycle keep their constraint.
    if (!ready.length) ready = remaining.filter((e) => inCycle(e, remaining, blockers));
    let pick = ready[0];
    for (const e of ready) if (beforeInOrder(e, pick)) pick = e;
    order.push(pick);
    emitted.add(String(pick.num));
    remaining = remaining.filter((e) => e !== pick);
  }
  return order;
}

/**
 * The contention-PREDECESSORS of an item within a pack: the items it contends with that come BEFORE it in the
 * single globally-consistent `orderedEntries` order. Direction is therefore inherited from that one linear
 * extension (real `blockedBy` edges honored as hard constraints, numeric order as tiebreak) — never from an
 * independent per-pair decision — so the relation is guaranteed acyclic. An item is dispatchable once every
 * predecessor has landed; this is what makes a mutually-contending group run as a single serial chain rather
 * than deadlocking, and it is why `readyAfter` can never wrongly return empty while items remain.
 */
export function predecessorsOf(item, entries) {
  const order = orderedEntries(entries);
  const idx = order.indexOf(item);
  return order.slice(0, idx).filter((o) => contends(item, o));
}

/**
 * ADAPTIVE re-evaluation. Given the pack and the set of already-LANDED item nums, return the pending items
 * that are dispatchable RIGHT NOW — every contention-predecessor is landed. Call it again after each land to
 * pick up the items that just freed. Degenerates: all-disjoint ⇒ everything ready at once (fan out);
 * full chain ⇒ exactly one ready at a time (serial).
 *
 * @param {Array} entries  the probed pack
 * @param {Iterable<string|number>} landedNums  nums of items whose lanes have landed
 * @returns {Array} the subset of `entries` dispatchable now (pending + all predecessors landed)
 */
export function readyAfter(entries, landedNums = []) {
  const landed = new Set([...landedNums].map(String));
  return entries.filter((e) => {
    if (landed.has(String(e.num))) return false; // already landed — not pending
    return predecessorsOf(e, entries).every((p) => landed.has(String(p.num)));
  });
}

/**
 * The full plan as ordered WAVES: wave 0 dispatches concurrently now; wave k+1 becomes dispatchable once
 * wave k lands (each wave = the `readyAfter` frontier once the earlier waves are treated as landed). A
 * single wave ⇒ everything parallel; N singleton waves ⇒ fully serial; otherwise a mix. The union of all
 * waves is exactly `entries` (every item is scheduled exactly once).
 *
 * @param {Array} entries  the probed pack
 * @returns {Array<Array>} waves, in dispatch order
 */
export function scheduleWaves(entries) {
  const waves = [];
  const landed = new Set();
  let remaining = entries.slice();
  while (remaining.length) {
    const wave = readyAfter(entries, landed);
    // Defensive, now PROVABLY unreachable: `orderedEntries` gives one consistent linear order, so the
    // earliest not-yet-landed item in that order has all its predecessors (all strictly earlier) already
    // landed and is therefore always ready ⇒ `wave` is non-empty whenever items remain (genuinely-cyclic
    // input is linearized too, not stalled). Kept only so a future relation change can never spin forever.
    const dispatch = wave.length ? wave : remaining;
    waves.push(dispatch);
    for (const e of dispatch) landed.add(String(e.num));
    remaining = remaining.filter((e) => !landed.has(String(e.num)));
  }
  return waves;
}

/**
 * Auto-SELECT the execution model for the pack — the headline of #2334. `all-parallel` when nothing contends
 * (one wave), `all-serial` when every item is its own wave (a full chain), `mixed` otherwise. An empty or
 * single-item pack is trivially `all-parallel`.
 *
 * @param {Array} entries  the probed pack
 * @returns {'all-parallel'|'all-serial'|'mixed'}
 */
export function selectModel(entries) {
  if (entries.length <= 1) return 'all-parallel';
  const waves = scheduleWaves(entries);
  if (waves.length <= 1) return 'all-parallel';
  if (waves.length === entries.length && waves.every((w) => w.length === 1)) return 'all-serial';
  return 'mixed';
}

/**
 * Human-readable reason for an item's placement — for the orchestrator's per-item `log` line. Pure, so the
 * test asserts the copy matches the relation that fired: a probe-less item, a `blockedBy` chain, a shared
 * drain-core file, or a clean fan-out.
 */
export function scheduleReason(item, entries) {
  if (mustSerialize(item)) return 'chained — unknown touch-set (probe failed), cannot fan out blind';
  const preds = predecessorsOf(item, entries);
  if (!preds.length) return 'parallel — disjoint, fans out now';
  const dep = preds.find((p) => blockEdge(item, p));
  if (dep) return `chained after #${dep.num} — blockedBy edge`;
  const shared = preds.find((p) => !disjoint(filesOf(item), filesOf(p)));
  if (shared) {
    const overlap = [...filesOf(item)].filter((f) => filesOf(shared).has(f) && !f.startsWith('we:backlog/'));
    const which = overlap.length ? ` (${overlap[0]})` : '';
    return `chained after #${shared.num} — shares a touch-set${which}`;
  }
  return `chained after #${preds[0].num} — contends`;
}
