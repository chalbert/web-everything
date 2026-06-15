---
type: issue
workItem: task
parent: "658"
status: open
blockedBy: ["693"]
dateOpened: "2026-06-15"
tags: []
---

# Migrate renderers/data-grid up to @frontierui/blocks (S2c-pre)

S2c precursor of #658, surfaced by #696. blocks/data-grid imports ../renderers/data-grid/renderDataGrid, which is WE-only and absent from @frontierui/blocks — so #696's byte-copy would dangle and break FUI's build. Migrate the renderers/data-grid render family (renderDataGrid.ts, editableGrid.ts, __fixtures__) UP to @frontierui/blocks first, byte-identical, WITHOUT deleting WE's copy (#170 guard), add to the S1 exports map. Apply the option-A type-harden (#695) if FUI's stricter tsc flags a latent type issue. Then #696 (S2c) is a clean byte-copy.
