---
type: issue
workItem: story
size: 3
parent: "723"
locus: frontierui
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
tags: []
---

# FUI traits public catalog + nav

13+ traits (blocks/**/traits/) have zero public pages — the #713 trigger; add a traits registry + catalog page + nav, curating internal-only traits. From the #723 audit.

## Progress

- Added `we:src/_data/traits.json` — registry of all 13 traits grouped by home: 4 reference capability traits (sortable/highlight/revealable/polling, with delivery badges) + 3 resource-loader strategy traits + 6 background-task-surface strategy traits. (No traits carry `@internal`, so none curated out; grouping conveys the per-block scope.)
- Extended the existing `/traits/` page (from #721) with a "Trait catalog" section rendering the registry as grouped cards — reuses the existing **Traits** nav entry rather than adding a duplicate.
