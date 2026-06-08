---
type: idea
workItem: story
size: 5
parent: "130"
status: resolved
dateOpened: '2026-06-07'
dateResolved: "2026-06-07"
graduatedTo: { url: /blocks/reorderable-list/, label: "Reorderable List block — withCrossListReorder (cross-list scope)" }
tags:
  - reorder
  - drag-and-drop
  - reorderable-list
  - cross-list
  - block
  - implementation
relatedReport: reports/2026-06-06-reorder-paradigms.md
relatedProject: webtraits
crossRef: { url: /blocks/reorderable-list/, label: Reorderable List block }
---

# Implement `withCrossListReorder` — move items between sibling lists

The [Reorderable List block](/blocks/reorderable-list/) shipped its Tier-1 surface in
[#130](/backlog/130-reorderable-list-implementation/): the `reduceReorder` keyboard engine
(grab-then-move), the reference renderer, the live-region announcer, the conformance audit + shared
fixtures, and the playground (keyboard headline + pointer drag with `Element.moveBefore()`). That
build deliberately scoped to **within-list** reorder (`reorder.scope.within-list`).

This item adds the Tier-2 **cross-list** scope: `withCrossListReorder` (`reorder.scope.cross-list`),
moving an item from one list into a sibling list that shares a group key (`reorder-group="…"`), the
pattern SortableJS exposes as cross-list groups.

## Scope

- A `scope="cross-list"` + `reorder-group` attribute pair binding sibling lists into one drag group.
- Engine extension: the order model becomes per-list, and a move can pop an item out of the source
  list's order and splice it into the target list's order at the drop index — both keyboard and
  pointer paths.
- Announcement of a cross-list move ("Moved Write the spec to list Done, position 2 of 3").
- Shared fixtures + a playground card showing two sibling lists with an item crossing between them,
  per the fixture-driven conformance pattern #130 established.

## Notes

- The report's ⚠ RECONCILE open point applies here: cross-list reorder is the **seam** with the
  data-transfer family ([#007](/backlog/007-gap-11-clipboard-dnd-files-intents/)). Confirm it stays
  "move semantics within the app" and composes with a future `drag-source`/`drop-target` rather than
  overlapping it — it is **not** OS-level `DataTransfer`.
- Build on the existing `reduceReorder` engine and `reconcileOrder` relocation rather than forking
  them; the within-list reducer is the inner loop of a cross-list move.

See `reports/2026-06-06-reorder-paradigms.md` (feature inventory: cross-list reorder is built-in,
Tier 2) and the within-list implementation in `blocks/renderers/reorderable-list/`.

## Progress

- **Status:** resolved
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - `blocks/renderers/reorderable-list/renderCrossListReorder.ts` — per-list order model + cross-list reducer that builds on `reduceReorder` (the within-list reducer is the inner loop for ArrowUp/Down); `relocate` free-movement primitive; Left/Right cross-list moves; cancel reverts across lists; commit snapshots every list's order; group-wide roving tabindex; `announceCrossList`; renderer (`<div data-reorder-group>` of `<ul scope="cross-list" reorder-group>`); `reconcileCrossList` (moveBefore across lists); `auditCrossListReorder`.
  - Shared fixtures `__fixtures__/cross-list-reorder-cases.ts` (8 cases: initial, cross-focus, edge-clamp, cross-move, cross-then-within, cross-commit, cross-cancel, cross-append).
  - Conformance suite `blocks/__tests__/unit/renderers/cross-list-reorder.test.ts` — 22 tests, green.
  - Playground: appended a cross-list section + live board to `demos/reorderable-list-demo.ts` (+ CSS for the group layout, list label via `attr(aria-label)`); updated demo HTML intro and `demos.json` description.
- **Verified:** 50 unit tests pass (28 within-list + 22 cross-list); `check:standards` 0 errors; browser (Playwright on the live :3000) shows 18/18 conformant, keyboard cross-list move + commit announce correctly, pointer cross-list drag relocates a card into a sibling list, no console errors.
- **Notes:** RECONCILE point honored — move-semantics-within-the-app, composes with a future `drag-source`/`drop-target` (#007), not OS `DataTransfer`. Keyboard model: vertical arrows move within a list, Left/Right move across sibling lists (Kanban-column convention). Engine handles empty lists but fixtures don't cover them yet → spun out as **#151**. Did not touch the within-list renderer/test/njk — a concurrent agent (#147 drop-position-indicator) is editing those.
