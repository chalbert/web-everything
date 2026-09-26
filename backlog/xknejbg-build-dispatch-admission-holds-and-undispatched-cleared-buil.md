---
kind: story
size: 5
parent: "4075"
status: open
blockedBy: ["xr05jjl"]
scope: ["we:scripts/conveyor/tick-core.mjs"]
dateOpened: "2026-09-26"
tags: [conveyor, daemons, flows, flow-checker]
---

# Build dispatch: admission holds and undispatched cleared builds are bounded; a build retry loop has a cap (flow gaps, tick-core)

tick-core: a capacity/load/queue-cap hold or an admitted build nobody dispatched, past a bound, is surfaced as an operator notice; a build item whose sessions keep ending with no outcome stops re-dispatching after a cap (mirror planFixSpawns fixRetryCap) and escalates. Clears build-dispatch held-admission x2, awaiting-dispatch-invocation, session-reaped-no-outcome uncapped-retry (xwo3j0l, xb4yerj).

## Slice

Sliced by FILE from the four flow-checker gap cards (xwuof33, xb4yerj, xwo3j0l, x56qzx8), so this slice's code scope is disjoint from every other slice's. The flow files under we:scripts/conveyor/flows/ cite file:line for each gap. Reuse what exists: the reconcile-notes channel (#2725, we:scripts/conveyor/reconcile-note-comment.mjs), the health-watch notify, and the existing caps.

Findings this slice clears:
- build-dispatch held-admission (no-owner, unbounded-wait)
- build-dispatch awaiting-dispatch-invocation (unbounded-wait)
- build-dispatch session-reaped-no-outcome (uncapped-retry)

## Done when

1. **Executable** — `node we:scripts/conveyor/flows/check.mjs --json` no longer lists the findings above (their `ack` entries are removed from the flow files and the flow data is updated to the fixed code, cited file:line); `we:scripts/conveyor/flows/__tests__/real-flows.test.mjs` stays green; a vitest for the new bound / cap / escalation goes red before the fix and green after.
2. **Live proof** — a before/after on the real daemons (or a replay of a real incident) showing the new bound / cap / escalation firing for at least one listed state.
