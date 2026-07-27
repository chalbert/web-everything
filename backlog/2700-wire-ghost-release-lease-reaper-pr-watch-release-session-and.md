---
bornAs: xbb1ku5
kind: story
size: 3
parent: "2677"
status: resolved
blockedBy: ["2699"]
scope: ["we:skills-src/conveyor/SKILL.md", "we:scripts/conveyor/"]
dateOpened: "2026-07-27"
dateStarted: "2026-07-27"
dateResolved: "2026-07-27"
tags: []
---

# Wire ghost-release (lease-reaper + pr-watch --release-session) and the now-live health/stall scan into the mechanical tick

Fold the lease-reclamation + health signals into the mechanized tick core (blocked on the tick-plan module). #2667 delivered the mechanisms (we:scripts/conveyor/lease-reaper.mjs, we:scripts/conveyor/pr-watch.mjs --release-session, pool-aware release) but EXPLICITLY deferred the SKILL wiring; #2616 populated the lane-to-num map so we:scripts/readiness/conveyor-state.mjs assessHealth is now LIVE, but the SKILL prose still calls the stall scan dormant (now stale). This slice: pass --release-session=conveyor-<num> when the tick arms a merge watcher, run the reaper each tick as the periodic backstop, and let the tick core consume state.health.verdict as the guard backstop the SKILL currently forbids relying on. Reconciles #2667/#2616 follow-ups; no new mechanism, pure wiring.

## Progress

Wired the three follow-ups into the mechanized tick (pure core / thin shell preserved; no guard semantics changed):

- **--release-session on merge watchers.** armWatchers now returns { pr, releaseSession } entries, deriving the owning-agent session per PR via the new pure releaseSessionForNum (conveyor-<num> for a build PR, prepare-<num> / prepare-decision-<num> for a prepare PR, from the live prepare guards). The SKILL step 4 watcher command passes it, so on merge pr-watch auto-releases the item's lane lease(s) across pools + resets the freed clone (the manual recipe, mechanized).
- **Lease-reaper each tick.** New SKILL step 4c runs the lease-reaper once per tick as the catch-all backstop for what merge-time auto-release misses (dead-agent leases, fix leases, down-main-session merges) — mirrors the step 4b infra-recovery pass (IO-shell backstop, no tick-core decision).
- **Health consumed as a backstop.** state.health is live now (#2616); planTick surfaces each stalled lane as a lane-stalled note (the reaper reclaims it on its TTL-stale axis). Flipped the stale "dormant / do not rely on state.health" SKILL prose. It never auto-re-dispatches a guard on a stall (3-min threshold is far below a guard's spawn-to-death TTL) — the guard TTLs stay the re-dispatch backstop.
