---
kind: task
parent: "3383"
status: resolved
scope: ["we:scripts/conveyor/parked-pr-conflict-watch.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# append-only statute conflicts resolve mechanically instead of standing down

The parked-PR conflict watch stands down every statute-tier conflict to a human, but a concurrent statute PR (e.g. PR #2505 vs main) that only appends a separate new ### rule section at the same insertion point is mechanically resolvable (keep both) and every future statute PR collides this same way. Add a pure classifier that recognizes an append-only section-insert patch, route such conflicts to the existing fix-agent finding path instead of stand-down, and pass the fixer an explicit keep-main-reinsert-new-sections instruction.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
