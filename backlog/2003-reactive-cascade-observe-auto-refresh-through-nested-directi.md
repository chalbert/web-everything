---
kind: story
size: 5
parent: "1971"
status: resolved
blockedBy: ["2001"]
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: none
tags: []
---

# Reactive cascade — observe() auto-refresh through nested directives

Wire directive state resolution (fui:blocks/view/resolveBinding.ts, fui:blocks/for-each/ForEachBehavior.ts) through fui:plugs/webstates/CustomChangeStrategyRegistry.ts observe(target,onChange):Disposable; on change auto-refresh() (microtask-batched). Combined with slice A's parent-child ownership, a parent refresh cascades to owned children. Slice B of #1971.
