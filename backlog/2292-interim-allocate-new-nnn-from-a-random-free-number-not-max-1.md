---
kind: story
size: 2
parent: "2289"
status: resolved
dateOpened: "2026-07-05"
dateStarted: "2026-07-07"
dateResolved: "2026-07-07"
graduatedTo: none
tags: []
---

# Interim: allocate new NNN from a random free number, not max+1 (cheap collision cut)

Cheap immediate stopgap to cut collision probability while the structural fix (#2290 drain-only plus #2288 JIT numbering) is built — filed from a concurrent drain-session handoff that leaned option-1-now plus option-4-as-the-real-fix. Change new-item allocation from max+1 to a random free number within the existing range: two lanes branching off the same main then rarely pick the same NNN (a low-probability birthday collision over a large free space) instead of deterministically colliding on max+1. It fills existing gap numbers rather than creating big new ones, so it does not worsen the big-gap concern — but it does scatter numbers out of creation order (tolerable, not ideal). Near-free: a small change in the scaffold allocator plus the same re-glob immediately before write. INTERIM — supersede once #2288 lands, which makes duplicate-NNN unrepresentable. Related: #2071, #2189.
