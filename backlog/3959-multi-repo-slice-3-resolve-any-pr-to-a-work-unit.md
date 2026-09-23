---
bornAs: xdx3ifb
kind: story
size: 5
parent: "3963"
status: open
blockedBy: ["3956"]
scope: ["we:scripts/conveyor/pr-work-unit.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:src/_data/backlog.js"]
dateOpened: "2026-09-23"
tags: []
---

# Multi-repo slice 3: resolve any PR to a work unit

New we:scripts/conveyor/pr-work-unit.mjs: (repoKey, pr) -> {attribution item|pr, itemNum, scope under the correct repo prefix, gate}. findItem also matches bornAs (a WE half landing renumbers an xid and orphans the still-open plateau branch naming it); the fallback diff scope uses the PR's own repo prefix, not we:; backlog locus derives from the scope prefix before tags (plateau items currently resolve to locus=webeverything, the wrong gate). Used by fix, CI-heal and reconcile.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
