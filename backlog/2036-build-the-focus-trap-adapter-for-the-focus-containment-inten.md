---
kind: story
size: 3
parent: "1451"
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
tags: []
---

# Build the focus-trap adapter for the Focus-Containment intent

No focus-trap library adapter exists in the registry. Register and build a focus-trap adapter bridging the library to the Focus-Containment intent (#013).

## Lineage
Surfaced 2026-07-01 in the first #1451 (Library-adapter watch) goal-completeness pass — a goal-set target-kind with no registry entry and no child. Report: [we:reports/2026-07-01-program-library-adapter-watch.md](../reports/2026-07-01-program-library-adapter-watch.md).

## Resolution (2026-07-01)

Built the focus-trap library adapter as a dependency-free bridge, registered it, and wired it to the
Focus-Containment intent (#013).

- **WE registry entry** — `we:src/_data/adapters/focus-trap-adapter.json` (`category: "lib"`,
  `status: "poc"`): the previously-missing goal-set target-kind now has a registry entry pointing at the
  [Focus-Containment intent](../src/_data/intents/focus-containment.json).
- **Impl (Frontier UI)** — `frontierui:adapters/focus-trap/focusTrapAdapter.ts`: a pure bridge that maps the
  intent's four dimensions (`trap` / `background` / `initialFocus` / `restore` + `target`) onto the
  `focus-trap` library's `Options` shape (`toFocusTrapOptions`), recovers them back with residual
  preservation (`fromFocusTrapOptions`), and drives a real trap through the intent's `contain` / `release`
  event contract (`createContainment`). FUI stays **dependency-free** — the library is *injected*, the
  `xstateAdapter` (#922) seam pattern — so `<dialog>` + native `inert` remain the recommended default and
  focus-trap is the opt-in bridge for consumers already on it.
- **Tests** — `frontierui:adapters/focus-trap/__tests__/focusTrapAdapter.test.ts` (22 passing): every
  dimension mapping, the author-time errors for `explicit` without a `target`, the round-trip on the mapped
  subset, residual preservation, and the idempotent runtime seam over an injected fake trap.

This closes the #1451 goal-set row `focus-trap → Focus-Containment intent` (was: no entry, no child). Two
sibling `lib` adapters (Floating UI #2034, Mousetrap #2035) remain `status:concept` stubs.
