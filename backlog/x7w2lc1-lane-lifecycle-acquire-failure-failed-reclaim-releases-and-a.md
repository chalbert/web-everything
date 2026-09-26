---
kind: story
size: 3
parent: "4075"
status: open
blockedBy: ["xr05jjl"]
scope: ["we:scripts/lane-pool.mjs", "we:scripts/conveyor/lease-reaper.mjs", "we:scripts/conveyor/lane-pool-health-watch.mjs"]
dateOpened: "2026-09-26"
tags: [conveyor, daemons, flows, flow-checker]
---

# Lane lifecycle: acquire failure, failed reclaim releases and a lane waiting for manual reclaim all reach someone (flow gaps, lane-pool/lease-reaper)

lane-pool acquire-failed leaves a durable record the health watch can read; lease-reaper caps releases per pass and escalates repeated release failures; a finished-needs-review lane waiting on a person past a bound is re-surfaced. Clears lane-lifecycle acquire-failed, lane-reclaimed-stale, lane-manual-reclaim-blocked (xwuof33, xb4yerj, xwo3j0l).

## Slice

Sliced by FILE from the four flow-checker gap cards (xwuof33, xb4yerj, xwo3j0l, x56qzx8), so this slice's code scope is disjoint from every other slice's. The flow files under we:scripts/conveyor/flows/ cite file:line for each gap. Reuse what exists: the reconcile-notes channel (#2725, we:scripts/conveyor/reconcile-note-comment.mjs), the health-watch notify, and the existing caps.

Findings this slice clears:
- lane-lifecycle acquire-failed (silent-failure)
- lane-lifecycle lane-reclaimed-stale (uncapped-retry)
- lane-lifecycle lane-manual-reclaim-blocked (unbounded-wait)

## Done when

1. **Executable** — `node we:scripts/conveyor/flows/check.mjs --json` no longer lists the findings above (their `ack` entries are removed from the flow files and the flow data is updated to the fixed code, cited file:line); `we:scripts/conveyor/flows/__tests__/real-flows.test.mjs` stays green; a vitest for the new bound / cap / escalation goes red before the fix and green after.
2. **Live proof** — a before/after on the real daemons (or a replay of a real incident) showing the new bound / cap / escalation firing for at least one listed state.
