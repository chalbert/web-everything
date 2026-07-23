---
bornAs: x7v8jvr
kind: story
size: 3
parent: "2612"
status: resolved
dateOpened: "2026-07-23"
dateStarted: "2026-07-23"
dateResolved: "2026-07-23"
tags: [plateau-loop, conveyor, scope-lease, status-board]
scope:
  - we:scripts/readiness/
  - we:scripts/conveyor/
---

# Conveyor lease-collection counts empty/stale leases (finished-agent lanes read as running)

The live scope-lease collector counts a **held-but-empty lane** as an active lease, so the conveyor's status view reads a *finished* agent's un-released lane as still "running" and over-counts the active lanes. An empty lease holds no scope, so it should not count.

**From the dry-run.** [`we:scripts/readiness/scope-lease-collect.mjs`](../scripts/readiness/scope-lease-collect.mjs) walks the live lane pool and, per held lease, reads its git diff and status to assemble the `leases` array the observer consumes. A lane whose agent has **finished but never released** — no diff, no `git status` change, no claimed backlog item — still holds a live lease marker, so the collector emits it as an active lease. Downstream, `we:scripts/readiness/conveyor-state.mjs` and the status-board's lane derivation then render that finished-agent lane as **running** and inflate the active-lane count that the dispatcher and the board both read.

**Why it's wrong.** An empty lease holds **no scope** — it is not contending for any file and is doing no work. Counting it as active is a false positive on two axes: the board misreports occupancy, and the active-lane count (which the dispatcher's concurrency ceiling reads) is inflated by ghost lanes.

**Fix.** Drop leases with **no observed scope and no claimed item** from the collected picture — either in `scope-lease-collect` (don't emit a zero-scope, zero-item lease) or in the board's lane derivation (don't render one as running). Prefer the collector, so every consumer sees the same de-ghosted set. This lines up with the earlier serial-floor-era note that an **empty lease shouldn't block dispatch** — the same "empty holds nothing" principle, applied to the *count* as well as the *gate*.

Refs the status-board ([#2613](/backlog/2613-the-conveyor-skill-command/)) and the scope-lease engine ([#2560](/backlog/2560-scope-lease-and-conflict-policy-engine/)).

## Progress

- Fixed at the **collector** (`we:scripts/readiness/scope-lease-collect.mjs`), so every consumer — observer, dispatcher, status-board — sees the same de-ghosted set.
- `collectSnapshot` gained an injected `itemsForLane(lane)` claimed-item signal. A lease with **empty observed scope AND no claimed item** is dropped as an empty/stale ghost. Predicted scope is intentionally excluded from the test (a ghost's leftover predicted scope is precisely the false-block being removed).
- The drop is **gated on item-awareness**: with no `itemsForLane` the collector keeps every leased lane (exact pre-#2623 back-compat), since a zero-observed lane could be freshly acquired mid-claim.
- IO shell derives the claim signal from the lane's diff: a live claim shows as a `we:backlog/<NNN>-*.md` change (via the new pure `backlogItemsFromObserved`); once the PR merges the file drops out — the finished-ghost state. No populated lane-ports registry or marker item field required (neither exists today); a future authoritative item source can supersede the fn unchanged.
- Tests: added ghost-drop coverage (dropped when empty+unclaimed; kept via a claim OR a diff; mixed-pool drops only the ghost; back-compat keep with no `itemsForLane`), `backlogItemsFromObserved` unit coverage, and an end-to-end check that a dropped ghost contributes no stale predicted scope to the observer picture. Full collector suite 51/51; sibling consumers (`we:scripts/readiness/dispatch-plan.mjs`, `we:scripts/readiness/conveyor-state.mjs`, `we:scripts/readiness/scope-lease-live.mjs`) green.
