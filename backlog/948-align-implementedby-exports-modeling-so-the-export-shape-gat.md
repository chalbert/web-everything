---
type: issue
workItem: story
size: 5
status: open
locus: webeverything
dateOpened: "2026-06-18"
tags: []
---

# Align implementedBy<->exports modeling so the export-shape gate can enumerate a block's full surface

Prereq for the #927 export-shape drift arm (filed when #927 was attempted+reverted in
batch-2026-06-18). The export-shape gate can't enforce today because a block's `implementedBy` names
**one** file while its `exports` span **sibling** modules — `router` points at `we:RouteViewElement.ts`
but declares `registerRouter`/`RouteOutletElement` living in sibling files; same for `for-each`, `tabs`,
`transient-component` (~7 blocks). A single-file gather can't see them, so the arm fails 7 blocks on a
modeling artifact, not real typos. This item aligns the model: either point `implementedBy` at an
enumerable module index, or scope `exports` to the named file, across the mismatched blocks — so #927's
resolver has a sound surface to compare against.
