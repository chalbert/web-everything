---
bornAs: xa4qb9f
kind: story
size: 3
parent: "3383"
relatedTo: ["3804", "3443", "3797"]
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:docs/agent/platform-decisions.md"]
status: resolved
dateOpened: "2026-09-21"
dateResolved: "2026-09-21"
tags: []
---

# Graduation slices: exempt from the drift hold, never copy a file main has moved (ruled in #3804 Fork 4)

Let a graduation slice to main land whatever the prototype's sync state: exempt graduation slices from the branch-drift-blocked hold, add the per-file freshness check to the slice procedure, and amend rule 1 of the Priority order in the epic.

Carved from the ratified decision #3804 (Fork 4; statute `we:docs/agent/platform-decisions.md#poc-branch-mechanical-sync`, point 4). The statute text and its clause 4(d) amendment landed with the decision; this item builds the behavior.

## What to build

- **The hold exemption.** `we:scripts/readiness/dispatch-plan.mjs` turns a drifted branch into the `branch-drift-blocked` hold for queued cards that overlap the branch's registered scope. A graduation slice (a #3443 slice whose target is `main`) is exempt from that hold.
- **The freshness rule, in the slice procedure.** In the slice procedure of #3443: for each file a slice ports, if `main` has a commit to that file since the merge base, apply the branch's change onto `main`'s current file as a diff and never copy the branch's file. A ported file in the open conflict set takes the staging ref's resolution when one exists; otherwise the port's version is recorded as the resolution the reconcile agent must adopt.
- **The Priority order.** Amend rule 1 of the Priority order in #3383 ("nothing may graduate before the health chain") to say it no longer holds for graduation slices, each of which runs `check:standards`, `test` and `smoke` on `main`'s tree in its own PR.

## Done when

1. **Executable** — `we:scripts/readiness/__tests__/dispatch-plan.test.mjs` passes under `npx vitest run` with a new case: a queued graduation slice whose scope overlaps a drifted branch is NOT held as `branch-drift-blocked`, while a non-graduation card with the same scope still is.
2. `grep -n "graduation slices" backlog/3443-*.md backlog/3383-*.md` shows the freshness rule in #3443's slice procedure and the amended rule 1 in #3383's Priority order, and `grep -n "open conflict set" backlog/3443-*.md` shows the conflict-set clause (a ported file in the open conflict set takes the staging ref's resolution, else the port's version is recorded for the reconcile agent to adopt) in the same procedure.
