---
kind: story
size: 3
parent: "4075"
status: open
blockedBy: ["xr05jjl"]
scope: ["we:skills-src/conveyor/delivery-agent-brief.md", "we:scripts/operations/delivery-report-record.mjs"]
dateOpened: "2026-09-26"
tags: [conveyor, daemons, flows, flow-checker]
---

# Builder landing: a failed lane acquire or pr-land exit 2/3 has a defined, reported outcome (flow gaps, delivery brief)

delivery-agent-brief + delivery-report-record: a builder whose lane acquire fails or whose pr-land exits 2/3 reports a named outcome (lane-unavailable / land-red / land-unmergeable) that the observer reads, instead of ad-hoc judgment. Clears build-dispatch pr-land-failed (silent + unbounded) and run-lane-pool-acquire (xwuof33, xwo3j0l, x56qzx8).

## Slice

Sliced by FILE from the four flow-checker gap cards (xwuof33, xb4yerj, xwo3j0l, x56qzx8), so this slice's code scope is disjoint from every other slice's. The flow files under we:scripts/conveyor/flows/ cite file:line for each gap. Reuse what exists: the reconcile-notes channel (#2725, we:scripts/conveyor/reconcile-note-comment.mjs), the health-watch notify, and the existing caps.

Findings this slice clears:
- build-dispatch pr-land-failed (silent-failure, unbounded-wait)
- build-dispatch step run-lane-pool-acquire (failure-no-exit)

## Done when

1. **Executable** — `node we:scripts/conveyor/flows/check.mjs --json` no longer lists the findings above (their `ack` entries are removed from the flow files and the flow data is updated to the fixed code, cited file:line); `we:scripts/conveyor/flows/__tests__/real-flows.test.mjs` stays green; a vitest for the new bound / cap / escalation goes red before the fix and green after.
2. **Live proof** — a before/after on the real daemons (or a replay of a real incident) showing the new bound / cap / escalation firing for at least one listed state.
