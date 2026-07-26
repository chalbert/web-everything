---
bornAs: xcbekzl
kind: story
size: 5
status: open
scope: ["we:scripts/conveyor/", "we:scripts/lane-pool.mjs"]
dateOpened: "2026-07-26"
tags: []
---

# Conveyor auto-releases a build's lane lease on PR-merge across all pools, and reaps dead-agent/stale orphan leases

On PR-merge, auto-release the item's lane lease in every pool it acquired (track the (pool, lane) pairs at dispatch time, so a cross-locus couple clears both repos); add a reaper that collects any lane whose owning agent PID is dead, whose lease is TTL-stale, or whose PR is merged/closed; make we:scripts/lane-pool.mjs release pool-aware. Extends #2623 from COUNTING stale leases to actually RECLAIMING them.

## Problem

When a conveyor-launched PR merges, the item's lane lease (`<lane>/.git/.lane-lease`) is **not auto-released** — the main session releases it by hand after each merge. That hand-release is error-prone and, in three confirmed ways, incomplete:

1. **Cross-locus builds acquire a lane in EACH repo pool** — e.g. `we:.lanes/web-everything/lane-N` **and** `we:.lanes/plateau-app/lane-M` — but the main-session `we:scripts/lane-pool.mjs release` targets only the WE pool. The plateau-app-side lane then lingers indefinitely. Observed: after #743 / #745 merged, the plateau-app pool still held live leases for `conveyor-1696` / `conveyor-2500` / `conveyor-2500b` / `conveyor-2604` whose impl halves (#107 / #108 / #109) had already merged.

2. **A dead agent leaves an orphan lease no PR-merge will ever clear.** If a delivery agent dies mid-build (API connection death), it strands a lease in **both** pools that no merge event can reap. Observed: a `conveyor-2500` plateau-app ghost from an API death; its retry `conveyor-2500b` ran in a different lane, so the original lease was never reclaimed.

3. **Stale / scopeless leases block unrelated dispatch.** A lease with no `predictedScope` (e.g. a fix-lane) is conservatively treated by the scope-lease collector as owning **everything**, so it holds any broad-scope item. Observed: #2440's whole-dir `we:scripts/lib/` scope was held behind a scopeless `fix-drain-cert` lease. Broad-scope items are **doubly** exposed to this.

## Proposed behaviour

- **Auto-release on merge, across every pool.** On `pr-watch` merge (exit 0) for a conveyor-launched item, auto-release its lane lease in **every** pool it acquired. Track the `(pool, lane)` pairs **at dispatch time**; a cross-locus couple records both repos' lanes so both are cleared on merge.

- **Add a lease reaper.** A lane whose owning agent process is **gone** (PID dead), whose lease is **TTL-stale**, or whose PR is **merged / closed** is auto-collected. This **extends #2623** — which made collection COUNT empty / stale leases correctly — from *counting* to actually *reclaiming* them.

- **Make release pool-aware.** Give `we:scripts/lane-pool.mjs release` a `--repo` / `--pool` selector (or release-by-session across all pools) so a single call clears a cross-locus lease in both repos at once.

## Related

- **#2623** (lease-collection counts empty / stale leases — RESOLVED). This item is the **reclamation follow-on**. See *Why #2623 does not already cover this*.
- **#2666** (conveyor auto-heals a launched PR whose CI goes red after open) — a **sibling conveyor-autonomy gap**: both close a hole where a launched PR's post-open lifecycle needs an automated hand the main session currently does manually.
- **Cross-locus couple mechanics** — the impl-first / WE-last two-PR couple (delivery-agent-brief) is where a single item acquires a lane in two pools; the merge-release and reaper must both be couple-aware.

### Why #2623 does not already cover this

#2623 fixed **COUNTING**: the scope-lease collector now tallies empty / stale leases correctly, so the dispatch plan's free-lane math is right. It did **not** make anything **RELEASE** those leases — a counted-as-stale lease still sits on disk holding its lane until a human clears it. #2623 also addressed only the **WE** pool's collection; it never touched the **multi-pool cross-locus** case (an item's plateau-app-side lane). This item adds the reclamation half (auto-release on merge + a reaper) and makes release pool-aware so the cross-locus lease is cleared in every pool.
