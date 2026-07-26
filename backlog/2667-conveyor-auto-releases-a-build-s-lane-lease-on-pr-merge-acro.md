---
bornAs: xcbekzl
kind: story
size: 5
status: resolved
scope: ["we:scripts/conveyor/", "we:scripts/lane-pool.mjs"]
dateOpened: "2026-07-26"
dateStarted: "2026-07-26"
dateResolved: "2026-07-26"
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

## Progress

Delivered the three reclamation mechanisms, scoped to the scripts (advisory `scope:`), each independently hand-usable:

1. **Pool-aware release** (`we:scripts/lane-pool.mjs`): a `--pool=<name>` selector (release/status a pool by its dir-name, no checkout path or origin URL needed) and `release --all-pools --session=<slug>` — sweeps **every** pool under `POOL_ROOT` and hands back that session's leases in one call (the cross-locus couple cleanup: WE lane + plateau-app lane at once). **No separate `(pool, lane)` ledger** — the lease markers already record the owning `session` at acquire (dispatch) time, so a by-session sweep IS the dispatch record (honours the #2612 "no parallel state store" rule). Reserved (permanent memory) leases are always skipped.
2. **Lease reaper** (`we:scripts/conveyor/lease-reaper.mjs`, new): pure core (`classifyReap` / `reapPlan`) + IO shell CLI. Walks all pools (or a `--pool`/`--repo` scope) and reclaims a lease on any axis — **PR merged/closed** (matched by head ref `lane/<num>-*`, so a couple's WE-last merge reclaims the impl-pool half too; best-effort via one `gh pr list`, degrades OFF if gh is unavailable), **TTL-stale** (the zero-IO dead-agent backstop), or **pid-dead**. Reserved leases are never reaped. Reclamation delegates to `lane-pool release … --force` so reserved-lane protection lives in one place. Verified against the real pool: dry-run correctly flags the actual multi-pool stale ghosts and leaves fresh leases alone.
3. **Auto-release on merge** (`we:scripts/conveyor/pr-watch.mjs`): opt-in `--release-session=<slug>` — on `EXIT_MERGED` the watcher shells the cross-pool by-session release before exiting (best-effort; a release failure never changes the merge exit code). The reaper is the periodic backstop for anything this misses.

**Design note — the "dead-agent PID" axis is DORMANT by construction.** The lease's recorded `pid` is the short-lived `lane-pool acquire` CLI (it exits right after stamping the marker — `we:scripts/lib/lane-lease.mjs` documents `pid` as informational-only), **not** the delivery agent (an LLM has no unix pid). A literal liveness check on it would reap **live** leases (the #2267 data-loss hazard), so the reaper's pid axis returns `null` (unknown) and never fires alone; dead-agent reclamation rides the **TTL-stale** backstop. The pure `pid-dead` branch is kept + tested so a future durable `agentPid` field lights it up unchanged. This mirrors the SKILL's own documented "dormant `state.health` stall scan" pattern.

**Follow-up (out of this item's scripts scope):** wire the mechanisms into the `/conveyor` SKILL tick loop — pass `--release-session=conveyor-<num>` when spawning the merge watcher (step 4), and run the reaper each tick as the periodic backstop. That is a consumer-side edit to the conveyor SKILL, disjoint from this item's `scripts/` scope; the mechanisms are complete and hand-usable today (the main session can already run `release --all-pools --session=X` in place of releasing N lanes one by one).

Tests: `we:scripts/conveyor/__tests__/lease-reaper.test.mjs` (pure reaper axes) and `we:scripts/__tests__/lane-pool-cross-pool.test.mjs` (cross-pool release + `--pool` selector, real clones). `check:standards` green.
