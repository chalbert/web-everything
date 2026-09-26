---
kind: story
size: 5
parent: "4075"
status: open
blockedBy: ["xr05jjl"]
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/reconcile-note-comment.mjs", "we:scripts/operations/completion-store.mjs"]
dateOpened: "2026-09-26"
tags: [conveyor, daemons, flows, flow-checker]
---

# Fix and review dispatch: round-cap and infra-retry exhaustion notify the operator; a long ci-heal session is bounded (flow gaps, reconcile-core)

reconcile-core: every cap-exhausted refusal and a PR stuck cycling blocked-on-infra push a note on the #2725 notes channel; a live ci-heal/fix/review session past a bound gets a note. Clears 6 flow findings (xwuof33, xb4yerj, xwo3j0l) in fix, review, ci-heal flows.

## Slice

Sliced by FILE from the four flow-checker gap cards (xwuof33, xb4yerj, xwo3j0l, x56qzx8), so this slice's code scope is disjoint from every other slice's. The flow files under we:scripts/conveyor/flows/ cite file:line for each gap. Reuse what exists: the reconcile-notes channel (#2725, we:scripts/conveyor/reconcile-note-comment.mjs), the health-watch notify, and the existing caps.

Findings this slice clears:
- fix round-cap-hit (silent-failure)
- review round-cap-exhausted (silent-failure, uncapped-retry)
- fix fixer-blocked-infra (uncapped-retry)
- review blocked-on-infra (uncapped-retry)
- ci-heal ci-heal-session-running (unbounded-wait)

## Done when

1. **Executable** — `node we:scripts/conveyor/flows/check.mjs --json` no longer lists the findings above (their `ack` entries are removed from the flow files and the flow data is updated to the fixed code, cited file:line); `we:scripts/conveyor/flows/__tests__/real-flows.test.mjs` stays green; a vitest for the new bound / cap / escalation goes red before the fix and green after.
2. **Live proof** — a before/after on the real daemons (or a replay of a real incident) showing the new bound / cap / escalation firing for at least one listed state.
