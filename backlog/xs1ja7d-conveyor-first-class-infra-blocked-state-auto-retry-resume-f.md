---
kind: story
size: 5
parent: "2612"
scope: ["we:scripts/conveyor/", "we:skills-src/conveyor/"]
status: open
dateOpened: "2026-07-24"
tags: [conveyor, infra, resilience]
---

# Conveyor: first-class infra-blocked state + auto-retry/resume for pre-PR infra failures

When a delivery or prepare agent builds successfully but PR-open fails on an outside dependency (a GitHub PR-creation outage, a network fault) *after* it has already pushed its lane ref, it returns `blocked-on-infra` with a resume handle. Today the conveyor has no first-class state for this: it is neither a review-park, a stall, nor gate-red, and the PR watcher (`we:scripts/conveyor/pr-watch.mjs`) cannot see it because no PR exists to watch. The built, pushed work is stranded with nowhere to be tracked.

## Build

Add an `infra-blocked` conveyor state that owns the recovery of pre-PR infra failures:

- Record the item plus its **resumable lane ref** (the pushed handle) so nothing is lost.
- Own an **idempotent retry loop**: exponential backoff, an attempt cap, then surface to the operator.
- **Correlate with GitHub status** when reachable, to tell a real outage from a one-off failure.
- **Resume-open the PR** automatically when infra recovers, from the recorded ref.
- Never strand the built work; **never fall back to a local merge** — the drain is the sole writer to `main` (memory rule 104).

## Acceptance

- A delivery agent that pushed its ref but failed PR-open lands in `infra-blocked`, not a stall or gate-red.
- The retry loop backs off, caps attempts, and resume-opens the PR once GitHub recovers.
- No path merges the lane locally; the drain stays the only writer to `main`.

Grounded in the 2026-07-24 GitHub Partial System Outage that blocked #2654's PR-open — the incident that motivated this story. Lives in [we:scripts/conveyor/](../../scripts/conveyor/) and the conveyor skill under `we:skills-src/conveyor/`.
