---
kind: story
size: 2
parent: "4075"
status: open
blockedBy: ["xr05jjl"]
scope: ["we:scripts/operations/dispatch-lane-io.mjs"]
dateOpened: "2026-09-26"
tags: [conveyor, daemons, flows, flow-checker]
---

# Build dispatch: an indeterminate session-spawn failure is reported durably (flow gap, dispatch-lane-io)

dispatch-lane-io: an INDETERMINATE claude --bg spawn failure writes a durable record/operator notice instead of surfacing only in the caller output. Deferred behind open PR #2741 (same file). Clears build-dispatch session-spawn-failed (xwuof33).

## Slice

**Deferred:** do not start until open PR #2741 (card xrv69j6) has landed — it owns the same files. (Not a `blockedBy` edge: that card is not on main yet.)

Sliced by FILE from the four flow-checker gap cards (xwuof33, xb4yerj, xwo3j0l, x56qzx8), so this slice's code scope is disjoint from every other slice's. The flow files under we:scripts/conveyor/flows/ cite file:line for each gap. Reuse what exists: the reconcile-notes channel (#2725, we:scripts/conveyor/reconcile-note-comment.mjs), the health-watch notify, and the existing caps.

Findings this slice clears:
- build-dispatch session-spawn-failed (silent-failure)

## Done when

1. **Executable** — `node we:scripts/conveyor/flows/check.mjs --json` no longer lists the findings above (their `ack` entries are removed from the flow files and the flow data is updated to the fixed code, cited file:line); `we:scripts/conveyor/flows/__tests__/real-flows.test.mjs` stays green; a vitest for the new bound / cap / escalation goes red before the fix and green after.
2. **Live proof** — a before/after on the real daemons (or a replay of a real incident) showing the new bound / cap / escalation firing for at least one listed state.
