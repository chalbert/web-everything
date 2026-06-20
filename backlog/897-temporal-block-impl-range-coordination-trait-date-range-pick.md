---
kind: story
size: 3
parent: "315"
status: resolved
blockedBy: ["736"]
locus: frontierui
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: frontierui/blocks/temporal/traits/RangeCoordination.ts
tags: []
---

# temporal block impl — range-coordination trait + date-range-picker preset

Author the `range-coordination` variant trait as a standalone CustomAttribute mixin in fui:frontierui/blocks/temporal/traits/RangeCoordination.ts (clone fui:blocks/traits/Sortable.ts) — enforce start <= end across two bound `<input type=date>` anchors, reported as an ordered pair. Add to the Enforcer traitMap (lazy), wire a date-range-picker preset fixture that binds calendar-grid + range-coordination. Realizes the WE date-range-picker contract (presentation=media calendar-grid, granularity=range, two input[type=date] anchors). blockedBy #736 — the date-range-picker preset binds calendar-grid, which #736 authors. Sibling slice under #315 (/slice 736). Demo: range stays ordered; both chunks present.

## Progress (resolved 2026-06-18) — locus frontierui

- **Trait** `fui:frontierui/blocks/temporal/traits/RangeCoordination.ts` — standalone `CustomAttribute` mixin coordinating two bound `<input type="date">` anchors (by `data-range="start|end"`, else document order) into an ordered pair, enforcing `start <= end`: the just-edited anchor is authoritative and pushes the other; projects `data-range-start`/`-end` on the host + emits `range-change`.
- **traitMap** — added `range-coordination` (lazy) to `frontierui/vite.config.mts`; registered `rangeCoordination` in `we:src/_data/traits.json`.
- **date-range-picker preset demo** — `frontierui/demos/date-range-picker.{html,ts}` composes `calendar-grid` (per input) + `range-coordination` (wrapper), proving both chunks load on demand and the pair stays ordered.
- **Tests** — `fui:__tests__/RangeCoordination.test.ts` (5: locate+report, drag-start-pushes-end, drag-end-pulls-start, ordered-edit-untouched, range-change event) green; FUI `check:standards` green (16 traits).

Unblocks #898 (datetime-picker, which composed on this + the clock slice).
