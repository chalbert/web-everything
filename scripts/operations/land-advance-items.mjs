/**
 * @file land-advance-items.mjs
 * The item-pull half of land-advance (#3720), pure. The queue source is epic #3383's `## Priority order`, read with
 * the gate's own row reader (`parsePriorityRows`, over `parsePriorityOrder`): never a second parser. Operator rule 1
 * skips claimed, design-first (band B), operator (band C, decision), needs-operator-fast-forward and in-flight lines.
 * Everything else (blockedBy, epics, no `scope:`, scope overlap, free lanes, the pause) is dispatch-plan's rule:
 * `planItems` only takes its launches up to the budget land-advance has left, never re-derives a hold.
 */
import { parsePriorityRows } from '../lib/prototype-tracker-compact.mjs';
export const ITEM_SKIP_REASONS = Object.freeze(['claimed', 'design-first', 'needs-operator', 'operator-decision', 'needs-operator-fast-forward', 'in-flight']);
/** How many items one call may queue while the operator has not ruled otherwise (the safest non-zero value). */
export const DEFAULT_MAX_ITEMS_PER_CALL = 1;
export function priorityQueue(trackerText, { inFlight = [] } = {}) {
  const { found, ordered, claimed } = parsePriorityRows(trackerText);
  if (!found) throw new Error('the tracker card has no "## Priority order" section');
  const busy = new Set(inFlight.map(String)), queue = [], skipped = claimed.map((c) => ({ num: c.id, rank: null, reason: 'claimed' }));
  for (const r of ordered) {
    const reason = r.size === 'decision' ? 'operator-decision' : /needs-operator-fast-forward/i.test(r.why) ? 'needs-operator-fast-forward'
      : r.band === 'C' ? 'needs-operator' : r.band !== 'A' ? 'design-first' : busy.has(r.id) ? 'in-flight' : null;
    if (reason) skipped.push({ num: r.id, rank: r.rank, reason }); else queue.push({ num: r.id, rank: r.rank });
  }
  return { queue, skipped };
}
export function planItems({ queue = [], skipped = [], itemPlan = {}, budget = 0, maxItems = DEFAULT_MAX_ITEMS_PER_CALL } = {}) {
  const rank = new Map(queue.map((q) => [String(q.num), q.rank])), take = Math.max(0, Math.min(budget, maxItems));
  const withRank = (x) => ({ ...x, num: String(x.num), rank: rank.get(String(x.num)) ?? null });
  const launch = (itemPlan.launch ?? []).map(withRank), proposed = launch.slice(0, take);
  const deferred = [...launch.slice(take).map((x) => ({ ...x, reason: proposed.length < budget ? 'per-call-cap' : 'capacity' })),
    ...(itemPlan.held ?? []).map((h) => withRank(h))].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  return { proposed, deferred, skipped };
}
