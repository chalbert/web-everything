---
kind: story
size: 3
status: open
scope: ["we:scripts/lib/citation-check.mjs", "we:docs/agent/platform-decisions.md"]
dateOpened: "2026-09-21"
tags: []
---

# citation-check: extend to freeform 'N of M' numeric claims about a cited item's own numbered lists

Found reviewing PR #2430 (statute clause codifying #3820): the clause miscounted #3779's evidence — 'three of its four Done-when items and three of its five design points were unbuilt' when the true counts were four of four and four of five. The citation-check gate family (we:scripts/lib/citation-check.mjs) already checks identifiers/anchors/loci/hash-slugs but does not check freeform 'N of M <plural>' numeric claims about a cited item's own numbered lists against the cited item's actual list length/unbuilt count. DESIGN TO SETTLE, not built here: whether this is gateable at general precision or only a narrow linter/review-time habit (the advisory reviewer that found this leaned toward the latter, since a hard gate needs to parse 'which of the cited item's N items are true' semantically, not just count list length).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
