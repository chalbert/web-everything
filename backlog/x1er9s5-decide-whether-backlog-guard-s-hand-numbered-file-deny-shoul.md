---
kind: decision
parent: "3383"
status: open
dateOpened: "2026-09-07"
tags: []
---

# Decide whether backlog-guard's hand-numbered-file DENY should widen to any new backlog file via Write

we:scripts/backlog-guard.mjs currently DENYs a hand-numbered new backlog/*.md file (numeric-only). #3548 (graduating we:scripts/operations/file-item.mjs) named a still-open question: should that DENY widen from numeric-only to ANY new backlog file created via the Write tool (i.e. bypassing file-item/scaffold entirely), now that a declared mechanical filing path exists on main? #3548 auto-resolved by scope-match when the file-item code landed (#1991) without this decision being made — filed separately so it is not silently dropped.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
