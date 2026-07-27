---
kind: story
size: 3
parent: "2677"
status: open
blockedBy: ["xyp63w5"]
scope: ["we:skills-src/conveyor/SKILL.md", "we:scripts/conveyor/"]
dateOpened: "2026-07-27"
tags: []
---

# Wire ghost-release (lease-reaper + pr-watch --release-session) and the now-live health/stall scan into the mechanical tick

Fold the lease-reclamation + health signals into the mechanized tick core (blocked on the tick-plan module). #2667 delivered the mechanisms (we:scripts/conveyor/lease-reaper.mjs, we:scripts/conveyor/pr-watch.mjs --release-session, pool-aware release) but EXPLICITLY deferred the SKILL wiring; #2616 populated the lane-to-num map so we:scripts/readiness/conveyor-state.mjs assessHealth is now LIVE, but the SKILL prose still calls the stall scan dormant (now stale). This slice: pass --release-session=conveyor-<num> when the tick arms a merge watcher, run the reaper each tick as the periodic backstop, and let the tick core consume state.health.verdict as the guard backstop the SKILL currently forbids relying on. Reconciles #2667/#2616 follow-ups; no new mechanism, pure wiring.
