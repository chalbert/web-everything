---
type: idea
workItem: story
size: 3
parent: "315"
status: resolved
blockedBy: []
locus: frontierui
dateOpened: "2026-06-16"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: frontierui/blocks/temporal/traits/CalendarGrid.ts
tags: []
---

# temporal block impl — calendar-grid trait + date-picker preset

Core slice of the temporal IMPL track (/slice 736, 2026-06-17). Author the **`calendar-grid` variant trait** as a standalone `CustomAttribute` mixin in `frontierui/blocks/temporal/traits/CalendarGrid.ts` (clone the `blocks/traits/Sortable.ts` shape: `activationSurface`, `connectedCallback`, activate/deactivate lifecycle) — a `role="grid"` calendar surface enhancing `<input type="date">`. Add it to the Enforcer `traitMap` (lazy, code-split per `tools/trait-enforcer/`), and wire a **date-picker preset** fixture/demo that binds `calendar-grid` so it lazy-loads on first DOM appearance. Realizes the WE `date-picker` contract (`blocks.json` — presentation=media calendar-grid, granularity=point, anchor `input[type=date]`). Demo: date-picker renders the grid; the calendar chunk is fetched on first appearance.

**Context (this is the core slice of 4; the #736 split is done — the others are scaffolded under #315).** Both prior forks are resolved: ownership (#779 → FUI-locus end-to-end, 2026-06-17) and scope (#713 → option C, one abstract core + named shallow presets). The pattern to slice against is FUI's existing `traits` family + `tools/trait-enforcer/`, not a not-yet-existent WE one. Sibling slices under #315: `clock` trait + time-picker preset; `range-coordination` trait + date-range-picker preset (blockedBy this slice); datetime-picker preset + #713 build-chunk dogfood (blockedBy this + the clock slice). Locale parse/format + keyboard roving are composed from other intents (Locale Intent, Focus Delegation) per the core contract — not traits authored here. Generic cross-bundler chunk-isolation conformance is separately owned by #720/#722; #894 relocates WE's misplaced enforcer copy out (independent). See reports/2026-06-17-backlog-split-analysis.md.

## Progress (resolved 2026-06-18) — locus frontierui

- **Trait** `frontierui/blocks/temporal/traits/CalendarGrid.ts` — a standalone `CustomAttribute` mixin cloned
  from `blocks/traits/Sortable.ts` (`activationSurface='interaction'`, connected/activated/deactivated/
  disconnected/detached lifecycle). Enhances `<input type="date">` with a `role="grid"` calendar surface
  (columnheaders + day `gridcell` buttons), seeds the displayed month from the input value (granularity=point),
  and writes the input value + `aria-selected` on day-cell selection. Per the #713 core contract, locale
  parse/format + keyboard roving are **composed from other intents (Locale Intent, Focus Delegation), not
  authored here** — keeping the abstract core shallow.
- **Enforcer traitMap** — added `'calendar-grid': '/blocks/temporal/traits/CalendarGrid'` (lazy, the default)
  to `frontierui/vite.config.mts`, so the calendar chunk is code-split and `defineLazy`-fetched on first
  appearance of `<input type="date" calendar-grid>`.
- **date-picker preset demo** — `frontierui/demos/date-picker.{html,ts}` binds `<input type="date" calendar-grid>`
  and drives the registerTraits → upgrade path, proving the chunk loads on demand (`data-calendar-grid-ready`).
- **Catalog** — registered `calendarGrid` in `src/_data/traits.json` (new "temporal block traits" group) and a
  `temporal` family entry in `src/_data/blocks.json` (FUI's completeness + trait-drift gates).
- **Tests** — `blocks/temporal/traits/__tests__/CalendarGrid.test.ts` (5 tests) green; FUI `check:standards`
  green (0 errors).

Sibling slices under #315: `clock` trait + time-picker preset (#896, independent); range-coordination +
datetime-picker presets (blocked on this/#896).
