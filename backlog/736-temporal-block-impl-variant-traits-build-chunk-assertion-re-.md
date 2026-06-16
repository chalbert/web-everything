---
type: idea
workItem: story
size: 13
parent: "315"
status: open
blockedBy: ["359", "735"]
dateOpened: "2026-06-16"
tags: []
---

# temporal block impl — variant traits + build-chunk assertion (re-slice)

Slice C of the picker work (/split 359, 2026-06-15) — the greenfield IMPL track, deferred. Author `calendar-grid` / `clock` / `range-coordination` as separate CustomAttribute trait modules, register each in traitMap (lazy by default), have each named preset declare only the traits it binds as HTML attributes, + the build-chunk assertion (#713: a time-only fixture pulls no calendar chunk). Deferred/re-slice: WE has zero authored traits today (traitEnforcer({ traitMap: {} }), vite.config.mts:104) and no blocks/temporal/ — impl seams aren't drawable to <=3 until A (#359) lands the first WE trait + core block pattern. Re-run /slice on this card after A lands → per-trait tasks + build-chunk assertion task. Locus watch-item: #713 placed the trait build in WE; confirm WE-vs-FUI (#658) ownership at re-slice (a re-estimate, not a fork). See reports/2026-06-15-backlog-split-analysis.md.
