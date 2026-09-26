---
kind: story
size: 2
parent: "4075"
status: open
blockedBy: ["xr05jjl"]
scope: ["we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-26"
tags: [conveyor, daemons, flows, flow-checker]
---

# Drain: a PR whose merge attempt keeps failing is counted and escalated (flow gap, merge-ai-prs)

merge-ai-prs: count consecutive failed merge attempts per PR head and park it for a person at a cap instead of retrying every sweep. Deferred behind open PR #2724 (same file). Clears drain-land merge-attempt (xb4yerj).

## Slice

**Deferred:** do not start until open PR #2724 (card xqpqyr2) has landed — it owns the same files. (Not a `blockedBy` edge: that card is not on main yet.)

Sliced by FILE from the four flow-checker gap cards (xwuof33, xb4yerj, xwo3j0l, x56qzx8), so this slice's code scope is disjoint from every other slice's. The flow files under we:scripts/conveyor/flows/ cite file:line for each gap. Reuse what exists: the reconcile-notes channel (#2725, we:scripts/conveyor/reconcile-note-comment.mjs), the health-watch notify, and the existing caps.

Findings this slice clears:
- drain-land merge-attempt (uncapped-retry)

## Done when

1. **Executable** — `node we:scripts/conveyor/flows/check.mjs --json` no longer lists the findings above (their `ack` entries are removed from the flow files and the flow data is updated to the fixed code, cited file:line); `we:scripts/conveyor/flows/__tests__/real-flows.test.mjs` stays green; a vitest for the new bound / cap / escalation goes red before the fix and green after.
2. **Live proof** — a before/after on the real daemons (or a replay of a real incident) showing the new bound / cap / escalation firing for at least one listed state.
