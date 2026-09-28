---
kind: task
status: open
scope: ["we:scripts/operations/probation-heal-run.mjs", "we:scripts/operations/probation-build-run.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Share the git-helper io between the two probation run scripts

we:scripts/operations/probation-heal-run.mjs and we:scripts/operations/probation-build-run.mjs each carry their own near-identical sh/trySh/node/diffNumstat/discardChanges helpers. A later fix to one (e.g. untracked-file edge cases) is not applied to the other, and the two drift apart. Extract the shared io primitives into one module both import. Flagged repeatedly by the converge panel on #4291's plan review (simplicity lens).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
