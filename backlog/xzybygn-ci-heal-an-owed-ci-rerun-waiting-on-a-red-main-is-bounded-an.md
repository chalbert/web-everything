---
kind: story
size: 2
parent: "4075"
status: open
blockedBy: ["xr05jjl"]
scope: ["we:scripts/conveyor/main-red-recovery.mjs", "we:scripts/conveyor/ci-red-recovery-watch.mjs"]
dateOpened: "2026-09-26"
tags: [conveyor, daemons, flows, flow-checker]
---

# CI-heal: an owed CI rerun waiting on a red main is bounded and surfaced (flow gap, main-red-recovery)

main-red-recovery / ci-red-recovery-watch: a PR refused owed-ci-rerun past a bound (main red too long) gets an operator note. Deferred behind open PR #2740 (same files). Clears ci-heal owed-ci-rerun-wait (xwo3j0l).

## Slice

**Deferred:** do not start until open PR #2740 (card xi4od2p) has landed — it owns the same files. (Not a `blockedBy` edge: that card is not on main yet.)

Sliced by FILE from the four flow-checker gap cards (xwuof33, xb4yerj, xwo3j0l, x56qzx8), so this slice's code scope is disjoint from every other slice's. The flow files under we:scripts/conveyor/flows/ cite file:line for each gap. Reuse what exists: the reconcile-notes channel (#2725, we:scripts/conveyor/reconcile-note-comment.mjs), the health-watch notify, and the existing caps.

Findings this slice clears:
- ci-heal owed-ci-rerun-wait (unbounded-wait)

## Done when

1. **Executable** — `node we:scripts/conveyor/flows/check.mjs --json` no longer lists the findings above (their `ack` entries are removed from the flow files and the flow data is updated to the fixed code, cited file:line); `we:scripts/conveyor/flows/__tests__/real-flows.test.mjs` stays green; a vitest for the new bound / cap / escalation goes red before the fix and green after.
2. **Live proof** — a before/after on the real daemons (or a replay of a real incident) showing the new bound / cap / escalation firing for at least one listed state.
