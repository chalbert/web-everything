---
kind: story
size: 5
parent: "1451"
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
tags: []
---

# Build the Floating UI positioning adapter behind the #149 DI seam

The #149 DI seam ships a swappable positioning-strategy provider but leaves the Floating UI provider as an owed fallback impl; the registry entry is status:concept. Wire Floating UI as a positioning provider over the seam and promote the adapter concept→implemented.

## Resolution
Built the Floating UI positioning adapter as the third `PositioningStrategy` behind the #149 seam (alongside the native CSS-Anchor and self-contained JS strategies).

- **Impl (FUI):** `fui:blocks/droplist/positioning/floating-ui.ts` — `createFloatingUiStrategy(fui)`, a **factory** that wraps the host's own `@floating-ui/dom` module and returns a `PositioningStrategy`. FUI does **not** bundle Floating UI: native-first stays the default, and the library is opt-in (the host injects the strategy over `POSITIONING_STRATEGY`, the #149 injector key). The adapter maps the WE `PlacementContext` intent (`placement`, `flip`/`shift`/`resize`) onto Floating UI's `computePosition` + `autoUpdate` + `flip`/`shift`/`size` middleware, positions `fixed` (viewport containing block — #161), and returns a reversible teardown that stops `autoUpdate` and removes every style it wrote. Exported from `fui:blocks/droplist/positioning/index.ts`. Covered by `fui:blocks/droplist/positioning/__tests__/floating-ui.test.ts` (7 tests, all green — 22/22 with the sibling strategy suite).
- **Registry (WE):** `we:src/_data/adapters/floating-ui-adapter.json` flipped `status: concept → implemented`.

The narrow `FloatingUiDomModule` interface is declared structurally (not `import('@floating-ui/dom')`) so FUI type-checks and unit-tests without the package installed — the same self-contained shape the JS fallback proves.

## Lineage
Surfaced 2026-07-01 in the first #1451 (Library-adapter watch) goal-completeness pass — the program had 0 adapter-build children and this adapter sits at status:concept behind the #149 seam. Report: [we:reports/2026-07-01-program-library-adapter-watch.md](../reports/2026-07-01-program-library-adapter-watch.md).
