---
kind: story
size: 5
parent: "4075"
status: open
blockedBy: ["xr05jjl"]
scope: ["we:scripts/lib/daemon-rebuild.mjs", "we:scripts/lib/daemon-overlays.mjs", "we:scripts/daemon-overlay.mjs"]
dateOpened: "2026-09-26"
tags: [conveyor, daemons, flows, flow-checker]
---

# Daemon rebuild: every stuck, rejected or held rebuild state notifies, and the overlay-list lock timeout has its own exit (flow gaps, daemon-rebuild)

daemon-rebuild: cap index-lock recovery, notify on a code-rejected build and on stuck-needs-hand-fix, raise clone-held-stale for a pinned refusal, catch the overlay-list mutex timeout as a named state; daemon-overlay CLI failure records a follow-up. Deferred behind open PR #2739 (same files). Clears 6 daemon-rebuild findings (xwuof33, xb4yerj, x56qzx8).

## Slice

**Deferred:** do not start until open PR #2739 (card x5wbsbc) has landed — it owns the same files. (Not a `blockedBy` edge: that card is not on main yet.)

Sliced by FILE from the four flow-checker gap cards (xwuof33, xb4yerj, xwo3j0l, x56qzx8), so this slice's code scope is disjoint from every other slice's. The flow files under we:scripts/conveyor/flows/ cite file:line for each gap. Reuse what exists: the reconcile-notes channel (#2725, we:scripts/conveyor/reconcile-note-comment.mjs), the health-watch notify, and the existing caps.

Findings this slice clears:
- daemon-rebuild rebuild-safety-recovery (uncapped-retry)
- daemon-rebuild stuck-needs-hand-fix (silent-failure)
- daemon-rebuild held-pinned-refusal (silent-failure)
- daemon-rebuild smoke-code-reject-rollback (uncapped-retry)
- daemon-rebuild cli-overlay-op-failed (silent-failure)
- daemon-rebuild step mutate-overlay-list (failure-no-exit)

## Done when

1. **Executable** — `node we:scripts/conveyor/flows/check.mjs --json` no longer lists the findings above (their `ack` entries are removed from the flow files and the flow data is updated to the fixed code, cited file:line); `we:scripts/conveyor/flows/__tests__/real-flows.test.mjs` stays green; a vitest for the new bound / cap / escalation goes red before the fix and green after.
2. **Live proof** — a before/after on the real daemons (or a replay of a real incident) showing the new bound / cap / escalation firing for at least one listed state.
