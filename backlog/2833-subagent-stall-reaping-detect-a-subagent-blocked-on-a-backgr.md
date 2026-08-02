---
bornAs: xr8wfqx
kind: story
size: 3
parent: "2612"
status: open
dateOpened: "2026-08-02"
tags: [conveyor, orchestrator-mechanization, harness, subagent]
---

# Subagent-stall reaping — detect a subagent blocked on a background wait and reap/resume it

The harness/orchestrator must detect a subagent that is blocked waiting on a background monitor and reap or resume it — or subagents must run their checks synchronously — so no main-session babysitting is needed.

## The concrete gap — what the main session did by hand tonight

- **A build subagent stalled waiting on a background monitor.** It launched a check in the background and then blocked, waiting for a completion signal that never advanced it. The subagent sat idle indefinitely.
- **The main session had to manually resume it.** Nothing detected the stall; a person noticed the agent was stuck and nudged it back into motion.

## Why this blocks a session-free conveyor

The conveyor dispatches build/review work into subagents and depends on each one either finishing or failing on its own. A subagent that blocks forever on a background wait is an invisible stall: it holds a lane, produces nothing, and never errors — so nothing reclaims it. In a session-free conveyor there is no main session watching for a stuck agent to nudge, so one such stall silently parks a lane and drains conveyor throughput until a human happens to look. Autonomy requires that a blocked-on-background-wait subagent be self-detected and cleared.

## The mechanical fix

Pick whichever is cleaner (or both — the detector is the backstop):

- **Reap/resume (harness backstop).** The harness/orchestrator detects a subagent that has been blocked on a background wait past a threshold (no forward progress, waiting on a monitor that has already settled or is not advancing) and REAPS it (fail + reclaim the lane) or RESUMES it (deliver the awaited signal). This is a general safety net regardless of how the subagent was written.
- **Synchronous checks (remove the footgun).** Subagents run their checks SYNCHRONOUSLY rather than launching a background monitor and blocking on it — so there is no background-wait to stall on in the first place. This removes the stall class at the source for conveyor-dispatched agents.

Either way, no main-session babysitting is required to get a stalled subagent moving again.

## Acceptance

- A subagent blocked on a background wait past a threshold is automatically detected and either reaped (failed + lane reclaimed) or resumed — with no main-session intervention.
- Alternatively (or additionally), conveyor-dispatched subagents run their checks synchronously, so the background-wait stall class cannot occur.
- Regression: reproduce the stalled-build-subagent scenario — a subagent that blocks on a never-advancing background monitor is cleared automatically, and its lane is freed.
