---
type: idea
status: open
dateOpened: '2026-06-07'
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
