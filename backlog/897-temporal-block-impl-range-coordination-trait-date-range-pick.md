---
type: idea
workItem: story
size: 3
parent: "315"
status: open
blockedBy: ["736"]
locus: frontierui
dateOpened: "2026-06-18"
tags: []
---

# temporal block impl — range-coordination trait + date-range-picker preset

Author the `range-coordination` variant trait as a standalone CustomAttribute mixin in frontierui/blocks/temporal/traits/RangeCoordination.ts (clone blocks/traits/Sortable.ts) — enforce start <= end across two bound `<input type=date>` anchors, reported as an ordered pair. Add to the Enforcer traitMap (lazy), wire a date-range-picker preset fixture that binds calendar-grid + range-coordination. Realizes the WE date-range-picker contract (presentation=media calendar-grid, granularity=range, two input[type=date] anchors). blockedBy #736 — the date-range-picker preset binds calendar-grid, which #736 authors. Sibling slice under #315 (/slice 736). Demo: range stays ordered; both chunks present.
