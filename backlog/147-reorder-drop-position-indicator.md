---
type: idea
status: open
dateOpened: '2026-06-07'
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
