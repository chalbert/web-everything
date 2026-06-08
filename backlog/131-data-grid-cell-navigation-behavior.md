---
type: idea
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-06"
dateResolved: "2026-06-07"
dateStarted: "2026-06-07"
graduatedTo: "blocks/data-grid/DataGridBehavior.ts (grid:cell-navigation behavior; registered in plugs/bootstrap.ts)"
tags: [data-grid, frontier-ui, focus-delegation, behavior, a11y, keyboard]
relatedProject: webblocks
crossRef: { url: /blocks/data-grid/, label: Data Grid block }
---

# Realize the `grid:cell-navigation` behavior in Frontier UI

The [Data Grid block](/blocks/data-grid/) (#123) shipped the **contract** and a reference renderer +
movement engine (`blocks/renderers/data-grid/renderDataGrid.ts`): `nextCellPosition` (the pure APG
keyboard model), `setActiveCell` (roving tabindex), and `auditDataGrid`. The conformance demo wires
those into a live grid *inline* in `demos/data-grid-demo.ts`. What does **not** exist yet is the
production **CustomAttribute behavior** — a real `<table role="grid" grid:cell-navigation>` anywhere
in an app does not become keyboard-navigable on its own.

Graduate the inline demo wiring into a Frontier UI behavior (per the repo constellation — WE holds
the standard, Frontier UI the implementation), mirroring how the Data Table behaviors land there:

- Bootstrap on the `grid:cell-navigation` attribute, seed the roving tabindex at the origin, and bind
  the `keydown` handler to `nextCellPosition` + `setActiveCell` + `.focus()`.
- **Scroll the active cell into view** on each move — free for real DOM focus today, but required the
  moment the grid is windowed/virtualized (the active row may not be realized; cf. the
  `aria-activedescendant` scroll caveat the Focus Delegation intent calls out).
- Expose the deferred **`wrap` option** (Focus Delegation `wrap`): last → first instead of clamping,
  off by default. The reference engine clamps; the behavior layers wrapping on opt-in.
- Confirm the behavior drives the *same* `auditDataGrid` green that the reference renderer does, so
  the contract holds through the real attribute, not just the demo.

## Progress
- **Status:** resolved — `grid:cell-navigation` behavior built, demo graduated onto it, all gates green.
- **Branch:** docs/standard-authoring-workflow
- **Repo placement:** built in **webeverything** `blocks/data-grid/` (not a separate Frontier UI
  repo). Rationale: every interactive-behavior precedent (`NavListBehavior` `nav:list`,
  `TypeAheadBehavior` `type-ahead`) lives in WE `blocks/`; the movement engine (`nextCellPosition`),
  `setActiveCell`, and `auditDataGrid` all live in WE, so the behavior imports the sibling engine and
  proves against the *same* audit in one repo. Frontier UI is the downstream consolidation that copies
  WE's implementation.
- **Done:**
  - `blocks/data-grid/DataGridBehavior.ts` — `grid:cell-navigation` CustomAttribute: seeds the roving
    tabindex, binds keydown → `nextCellPosition` + `setActiveCell` + `.focus()`, **scrolls the active
    cell into view** each move, reads dims live from the DOM (survives windowing), clamps by default
    and layers opt-in `wrap` (`grid:cell-navigation="wrap"`), click-to-focus, emits `grid-cell-change`.
  - `blocks/data-grid/registerDataGrid.ts` + wired into `plugs/bootstrap.ts`.
  - Demo `demos/data-grid-demo.ts` interactive card **graduated** onto the real behavior (was inline
    glue) + a wrap toggle; `demos/data-grid-demo.css` wrap-toggle style.
  - Unit test `blocks/__tests__/unit/data-grid/DataGridBehavior.test.ts` (24 tests) — incl. driving the
    **same `auditDataGrid` green** over every shared fixture through the attribute.
  - Block page `data-grid.njk` updated (scroll-into-view, opt-in wrap, live-from-DOM dims).
  - Gates: vitest 1468 pass; `check:standards` 0 errors; vite build clean; data-grid e2e playground
    green; live Playwright check (arrow nav + wrap toggle) verified, zero console errors.
- **Leftover captured:** [#144](/backlog/144-data-grid-behavior-auto-upgrade-e2e/) — no test yet proves
  the bootstrap registration auto-upgrades an *authored* grid (demo + unit attach manually; same gap for
  `nav:list` / `type-ahead`).
