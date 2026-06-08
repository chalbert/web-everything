---
type: decision
workItem: story
size: 2
status: open
dateOpened: "2026-05-31"
tags: [gap-analysis, intent, clipboard, drag-drop, files]
---

# Decide on Clipboard / DnD / Files intents (gap #11)

DataTransfer primitives — Clipboard API, Drag & Drop, File System Access. Probably intents, not a project.

## Triage context

- **Kind**: Intent(s)
- **Native anchor**: Clipboard API, Drag & Drop, File System Access
- **Native-first**: ▽ low · **Gap**: ◆ medium · **Effort**: ▽ low
- **Rank**: 11

## Open call

One bundled intent vs three separate intents; confirm "intents, not a project" call.

## Related — reorder split off

The **reorder** family (user-mutable order of a collection) has been split out and codified
separately as the [`reorder` intent](/intents/reorder/) + [Reorderable List block](/blocks/reorderable-list/)
under [#022](/backlog/022-drag-and-drop-paradigms/) (`reports/2026-06-06-reorder-paradigms.md`).
This item now owns only the **data-transfer** half — moving a *payload* (clipboard text, dropped
files, items dragged across a boundary) into a zone that validates what it accepts. Decide the
drag-source / drop-target / accepts contract here; cross-list reorder is the seam to keep clean
(it is in-app "move" semantics, not OS-level DataTransfer).
