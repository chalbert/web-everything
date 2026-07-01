---
kind: story
size: 5
parent: "1971"
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: none
tags: []
---

# Keyed reconciliation in ForEach (DOM reuse by key)

Implement the diff the ForEach #key was reserved for (fui:blocks/for-each/ForEachBehavior.ts:75-76,99): reuse stamped DOM for matching keys, stamp/unstamp only the delta, index-fallback when unkeyed. Reorder via insertBefore (correct; slice D upgrades to moveBefore). Slice C of #1971.
