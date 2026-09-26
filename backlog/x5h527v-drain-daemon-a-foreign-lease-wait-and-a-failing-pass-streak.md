---
kind: story
size: 3
parent: "4075"
status: open
blockedBy: ["xr05jjl"]
scope: ["plateau-app:tools/drain-daemon/"]
dateOpened: "2026-09-26"
tags: [conveyor, daemons, flows, flow-checker]
---

# Drain daemon: a foreign lease wait and a failing-pass streak are bounded and notify the operator (flow gaps, plateau drain-daemon)

plateau-app drain daemon: waiting on a foreign drain lease past a bound notifies once per holder episode; consecutive failed passes (incl. duplicate-NNN) hit a cap that escalates once per streak, still retrying at the ceiling. Clears drain-land lease-arbitration, pass-running, duplicate-nnn-parked (xb4yerj, xwo3j0l).

## Slice

Sliced by FILE from the four flow-checker gap cards (xwuof33, xb4yerj, xwo3j0l, x56qzx8), so this slice's code scope is disjoint from every other slice's. The flow files under we:scripts/conveyor/flows/ cite file:line for each gap. Reuse what exists: the reconcile-notes channel (#2725, we:scripts/conveyor/reconcile-note-comment.mjs), the health-watch notify, and the existing caps.

Findings this slice clears:
- drain-land lease-arbitration (unbounded-wait)
- drain-land pass-running (uncapped-retry)
- drain-land duplicate-nnn-parked (uncapped-retry)

## Done when

1. **Executable** — `node we:scripts/conveyor/flows/check.mjs --json` no longer lists the findings above (their `ack` entries are removed from the flow files and the flow data is updated to the fixed code, cited file:line); `we:scripts/conveyor/flows/__tests__/real-flows.test.mjs` stays green; a vitest for the new bound / cap / escalation goes red before the fix and green after.
2. **Live proof** — a before/after on the real daemons (or a replay of a real incident) showing the new bound / cap / escalation firing for at least one listed state.
