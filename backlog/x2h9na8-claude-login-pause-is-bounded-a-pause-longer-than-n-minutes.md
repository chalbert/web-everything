---
kind: story
size: 2
parent: "4075"
status: open
blockedBy: ["xr05jjl"]
scope: ["we:scripts/conveyor/claude-auth-health.mjs"]
dateOpened: "2026-09-26"
tags: [conveyor, daemons, flows, flow-checker]
---

# Claude-login pause is bounded: a pause longer than N minutes notifies the operator (flow gaps, claude-auth-health)

claude-auth-health: record when the fix/review dispatch gate first closed; past a bound (e.g. 20 min) raise a one-shot operator notice via the health-watch notify path. Clears fix login-broken-paused and review claude-auth-paused (xwo3j0l).

## Slice

Sliced by FILE from the four flow-checker gap cards (xwuof33, xb4yerj, xwo3j0l, x56qzx8), so this slice's code scope is disjoint from every other slice's. The flow files under we:scripts/conveyor/flows/ cite file:line for each gap. Reuse what exists: the reconcile-notes channel (#2725, we:scripts/conveyor/reconcile-note-comment.mjs), the health-watch notify, and the existing caps.

Findings this slice clears:
- fix login-broken-paused (unbounded-wait)
- review claude-auth-paused (unbounded-wait)

## Done when

1. **Executable** — `node we:scripts/conveyor/flows/check.mjs --json` no longer lists the findings above (their `ack` entries are removed from the flow files and the flow data is updated to the fixed code, cited file:line); `we:scripts/conveyor/flows/__tests__/real-flows.test.mjs` stays green; a vitest for the new bound / cap / escalation goes red before the fix and green after.
2. **Live proof** — a before/after on the real daemons (or a replay of a real incident) showing the new bound / cap / escalation firing for at least one listed state.
