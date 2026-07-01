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

# Build the TanStack Virtual adapter for the Windowed-Collection intent

No windowing adapter exists. Bridge TanStack Virtual to the Windowed-Collection intent and add the registry entry.

## Resolution
Built the adapter as a pure data transform (the XState-adapter pattern — the library is injected, so FUI
stays dependency-free and the intent stays the lock):

- **frontierui:** `frontierui:blocks/droplist/tanstackVirtualAdapter.ts` — translates TanStack Virtual's
  `Virtualizer` options + `VirtualItem[]` output ↔ the Windowed-Collection intent's window math
  (`computeScrollWindow` / `computeVariableWindow` / `spacerHeights` / `buildOffsets` in
  `frontierui:blocks/droplist/Windowed.ts`). `virtualItemsToWindow`, `virtualItemsToSpacers`,
  `toVirtualizerOptions`, plus a native-math twin (`computeVirtualItems` / `totalSizeFor`) so a consumer
  can drive the intent without the library. Covered by
  `frontierui:blocks/droplist/__tests__/tanstackVirtualAdapter.test.ts` (10 specs) — slice + spacer parity
  against the native math on both the fixed-height and variable-height (`measure`) paths.
- **we (definition only):** registry entry `we:src/_data/adapters/tanstack-virtual-adapter.json`
  (`category: lib`, `status: poc`) + its detail page
  `we:src/_includes/adapter-descriptions/tanstack-virtual-adapter.njk`.

`status: poc` — the pure seam ships and is verified; the full live TanStack-backed runtime wiring (a real
`Virtualizer` on a scroll container) is the deferred slice, same posture as the XState engine adapter.

## Lineage
Surfaced 2026-07-01 in the first #1451 (Library-adapter watch) goal-completeness pass — a goal-set target-kind with no registry entry and no child. Report: [we:reports/2026-07-01-program-library-adapter-watch.md](../reports/2026-07-01-program-library-adapter-watch.md).
