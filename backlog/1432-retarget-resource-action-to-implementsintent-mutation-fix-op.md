---
kind: task
status: resolved
blockedBy: []
relatedProject: webintents
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/blocks/resource-action.json"
tags: []
---

# Retarget resource-action to implementsIntent mutation + fix optimistic intentDimension

Ratified by #1395 Fork 1(a). Edit we:src/_data/blocks/resource-action.json: flip `implementsIntent` from `action` to `mutation` (line 7), and move `withOptimisticMutation.intentDimension` from `loader.strategy.optimistic` to `mutation.strategy.optimistic` (line 155). The block still draws on `action` for the trigger's visual weight (`action.busy`, line 150) — only the write-lifecycle dimension retargets. `loader.strategy.optimistic` stays as the read/non-blocking strategy (a homonym on a different axis). Blocked on #1431 (intent must exist).

## Progress

- we:src/_data/blocks/resource-action.json: `implementsIntent` flipped `action` → `mutation`; the
  `withOptimisticMutation` trait's `intentDimension` moved `loader.strategy.optimistic` →
  `mutation.strategy.optimistic`. The block now declares the intent it actually realizes (the write
  lifecycle #1431 minted), instead of squatting on `action` (visual weight) + a read-side loader
  dimension.
- Left intact (correct per the ruling): the `action.busy` intentDimension (the trigger still draws its
  visual weight + busy state from action), and `loader.strategy.optimistic` elsewhere (the read/non-
  blocking strategy — a homonym on a different axis). Cleared the stale `blockedBy: ["1431"]`.
