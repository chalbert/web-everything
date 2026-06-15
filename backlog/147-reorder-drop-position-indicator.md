---
type: idea
workItem: story
size: 3
parent: "130"
status: resolved
dateOpened: '2026-06-07'
dateResolved: "2026-06-07"
graduatedTo: "block:reorderable-list"
tags:
  - reorder
  - drag-and-drop
  - reorderable-list
  - styling-hook
  - accessibility
relatedReport: reports/2026-06-06-reorder-paradigms.md
relatedProject: webtraits
crossRef: { url: /blocks/reorderable-list/, label: Reorderable List block }
---

# Reorder drop-position indicator — render the `[data-reorder-target]` gap

The [Reorderable List block](/blocks/reorderable-list/) implementation
([#130](/backlog/130-reorderable-list-implementation/)) specs a `[data-reorder-target]` styling hook
for the candidate drop position (the gap / placeholder shown while an item is being moved), and the
block description documents it — but the reference renderer does **not** yet emit it. During a
keyboard or pointer move today, the grabbed item is marked `[data-reorder-grabbed]` and slides into
place, but there is no separate placeholder marking where it would land.

This item implements the report's 🔨 ROUGH open point: render the drop-target hook so themes can
draw the gap, without prescribing the visuals.

## Scope

- During a move (keyboard or pointer), mark the candidate landing slot with `[data-reorder-target]`
  so CSS can render a gap/placeholder line; clear it on drop/cancel.
- Extend `reconcileOrder` (or a sibling helper) to set/clear the marker in lockstep with the grabbed
  state, keeping the renderer the single source the audit checks.
- Add an audit check + a fixture/playground case asserting exactly one `[data-reorder-target]` exists
  during a move and none at rest.
- Leave the actual visuals (line vs. shaded slot) to the implementation/theme — spec only the hook,
  per the report.

See `reports/2026-06-06-reorder-paradigms.md` (Open points → "ROUGH — drop-position indicator") and
the styling-hooks section of `src/_includes/block-descriptions/reorderable-list.njk`.

## Progress

- **Status:** resolved
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - Settled the semantics: the reference reducer relocates the grabbed item *live* into its landing
    slot (both keyboard + pointer), so the candidate drop position **is** the grabbed item's current
    slot. `[data-reorder-target]` co-locates with `[data-reorder-grabbed]` here, but stays an
    independent hook so a theme can draw the gap/placeholder distinctly from the lifted card.
  - Emit `[data-reorder-target]` from `renderReorderableList` (`itemEl`) and `reconcileOrder` in
    lockstep with the grabbed marker (set on grab, cleared on drop/cancel).
  - Added audit checks: exactly one `[data-reorder-target]` during a move, none at rest.
  - Added 2 conformance tests; all existing fixtures still audit clean (28 pass).
  - Added a demo visual (dashed accent outline) + updated the njk styling-hooks note.
  - Marked the report's 🔨 ROUGH open point resolved.
  - Verified live in the playground (:3000): 9/9 conformant, one target during a move, cleared on
    drop, no console errors.
- **Notes:** Visuals (line vs. shaded slot) left to the theme, per the report.

**Graduated to** `block:reorderable-list` — data-reorder-target styling hook.
