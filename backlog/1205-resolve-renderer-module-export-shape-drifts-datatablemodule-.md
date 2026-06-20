---
type: decision
workItem: story
size: 2
parent: "904"
status: resolved
blockedBy: ["1204"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: none
codifiedIn: one-off
tags: []
---

# Resolve renderer Module export-shape drifts (DataTableModule/PaginationModule/DataGridModule absent)

Once #1164 coverage lands, the 8e arm surfaces 3 genuine renderer drifts: DataTableModule, PaginationModule, DataGridModule are declared in we:src/_data/blocks/<id>.json exports but exist NOWHERE in fui:blocks/ (grep=0, verified 2026-06-20); CollectionOperationsModule is present. Source-of-truth call per drift (mirror of #1165): either the we: contract over-declares the *Module name (correct exports to the real behavior surface) or the FUI impl is incomplete (file a locus:frontierui build). data-grid is a draft (leaf DataGridBehavior/registerDataGrid exist, not barrel-published). blockedBy #1204.

---

## SUPERSEDED by #1218 (resolved 2026-06-20)

Duplicate, concurrent-session item: #1218 ("Resolve 3 renderer export-shape drift findings —
data-table / pagination / data-grid") covers the **identical** three `*Module` drifts and was prepared +
ratified first. Its grounding also corrects this item's premise: the "grep=0 / exist NOWHERE" claim is
**wrong** for data-table/pagination — both ship the element class as `DataTableElement`/`PaginationElement`
(`extends HTMLElement`), so the drift there is a `*Element`→`*Module` **rename**, not an absence. data-grid's
behavior+registrar also exist (as a `grid:cell-navigation` `CustomAttribute` in `fui:blocks/data-grid/`); only
the `DataGridModule` element is absent.

The #1218 ruling (A1 rename + B1 build, applying the `#export-shape-drift` axis) IS the resolution of this
item; its two `locus: frontierui` builds (#1229 rename, #1230 data-grid element) are the deliverables this
item would have filed. Resolved as superseded — no separate work.
