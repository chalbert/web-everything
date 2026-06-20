---
kind: story
size: 3
parent: "315"
status: resolved
locus: frontierui
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: frontierui/blocks/temporal/traits/Clock.ts
tags: []
---

# temporal block impl — clock trait + time-picker preset

Author the `clock` variant trait as a standalone CustomAttribute mixin in fui:frontierui/blocks/temporal/traits/Clock.ts (clone fui:blocks/traits/Sortable.ts) — a spatial clock surface enhancing `<input type=time>`. Add to the Enforcer traitMap (lazy, code-split), wire a time-picker preset fixture that binds `clock` so it lazy-loads on first appearance. Realizes the WE time-picker contract (presentation=media clock, granularity=point, anchor input[type=time]). Independent of the calendar-grid trait. Sibling slice of #736 under #315 (/slice 736). Demo: time-picker renders the clock, lazy-loaded.

## Progress (resolved 2026-06-18) — locus frontierui

- **Trait** `fui:frontierui/blocks/temporal/traits/Clock.ts` — standalone `CustomAttribute` mixin (same shape as
  CalendarGrid/Sortable). Enhances `<input type="time">` with a spatial clock surface: two `role="listbox"`
  groups (hours 00–23, minutes 00–55 by 5), seeds the selection from the input value, composes `HH:MM` onto the
  input on hour+minute selection, marks `aria-selected`. Locale parse/format + keyboard roving composed from
  other intents per the #713 core contract, not authored here.
- **traitMap** — added `clock: '/blocks/temporal/traits/Clock'` (lazy) to `frontierui/vite.config.mts`.
- **time-picker preset demo** — `frontierui/demos/time-picker.{html,ts}` binds `<input type="time" clock>` and
  drives registerTraits → upgrade, proving the chunk loads on demand (`data-clock-ready`).
- **Catalog** — registered `clock` in `we:src/_data/traits.json` (temporal block traits group; the `temporal`
  family entry from #736 already covers fui:blocks.json).
- **Tests** — `fui:blocks/temporal/traits/__tests__/Clock.test.ts` (5 tests) green; FUI `check:standards` green.

Unblocks the range-coordination + datetime-picker sibling slices under #315 (which were blocked on this + #736).
