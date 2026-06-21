---
kind: task
status: open
blockedBy: ["1431"]
relatedProject: webintents
dateOpened: "2026-06-21"
tags: []
---

# Retarget resource-action to implementsIntent mutation + fix optimistic intentDimension

Ratified by #1395 Fork 1(a). Edit we:src/_data/blocks/resource-action.json: flip `implementsIntent` from `action` to `mutation` (line 7), and move `withOptimisticMutation.intentDimension` from `loader.strategy.optimistic` to `mutation.strategy.optimistic` (line 155). The block still draws on `action` for the trigger's visual weight (`action.busy`, line 150) — only the write-lifecycle dimension retargets. `loader.strategy.optimistic` stays as the read/non-blocking strategy (a homonym on a different axis). Blocked on #1431 (intent must exist).
