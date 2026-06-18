---
type: idea
workItem: story
size: 3
parent: "315"
status: open
locus: frontierui
dateOpened: "2026-06-18"
tags: []
---

# temporal block impl — clock trait + time-picker preset

Author the `clock` variant trait as a standalone CustomAttribute mixin in frontierui/blocks/temporal/traits/Clock.ts (clone blocks/traits/Sortable.ts) — a spatial clock surface enhancing `<input type=time>`. Add to the Enforcer traitMap (lazy, code-split), wire a time-picker preset fixture that binds `clock` so it lazy-loads on first appearance. Realizes the WE time-picker contract (presentation=media clock, granularity=point, anchor input[type=time]). Independent of the calendar-grid trait. Sibling slice of #736 under #315 (/slice 736). Demo: time-picker renders the clock, lazy-loaded.
