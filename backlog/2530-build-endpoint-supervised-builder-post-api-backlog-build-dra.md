---
bornAs: xr1vhog
kind: story
size: 8
parent: "2527"
status: open
blockedBy: ["2444", "2528"]
dateOpened: "2026-07-16"
tags: [plateau-loop, build-queue, builder, console]
---

# Build endpoint + supervised builder — POST /api/backlog/build drains the queue at WIP=1

The autonomous builder: `POST /api/backlog/build` pulls the queue's `next-to-build` (slice A) and runs a supervised `claude -p` child that builds the item and opens a ready-to-merge PR, at **WIP=1, non-preemptive** (one build in flight; decide the next only at completion). The row shows a true in-flight ⟳ → PR. Needs the agent-runner contract — this is the consumer that **un-parks decision [#2444](/backlog/2444-plateau-loop-phase-1-agent-runner-shape-cli-spawn-contract-s/)** (prepare + ratify #2444, build its `spawn/steer/stop/resume` runner, then wire this endpoint to it). Carries real autonomous per-click spend — the most dangerous control in the console, so it ships behind eligibility + confirm + a spend/quota guard.

**Acceptance:** `POST /api/backlog/build` acquires a lane, spawns the supervised runner on the queue's `next-to-build`, records a run, and returns 202 for polling; only *ready* items are ever pulled (the hard readiness gate); WIP=1 is enforced (a second build is refused/queued, never concurrent); the run is non-preemptive and re-evaluates `next` only at completion; failure is surfaced honestly; a spend/quota guard + confirm gates the trigger. Blocked until #2444 ratifies the runner contract.
