---
type: issue
workItem: story
size: 5
parent: "170"
status: open
dateOpened: "2026-06-18"
tags: []
---

# Close the 10 block contract-impl drift gaps in FUI + flip BLOCK_IMPL_DRIFT_ENFORCED + add export-shape arm

The #659 drift gate (validateBlockImplConformance) WARNs on 10 blocks whose implementedBy points at a FUI impl that does not resolve in ../frontierui (code-view, collection-operations, data-transfer, draft-persistence, props-table, reorderable-list, rich-text-editor, story-canvas, wizard, workflow-engine). Build those FUI impls (locus frontierui) or correct the references, then flip BLOCK_IMPL_DRIFT_ENFORCED=true in scripts/check-standards-rules.mjs so a moved/deleted impl hard-fails (the #726 analogue for blocks). Second arm (deferred from #659, which shipped impl-existence only): extend the gate to compare each block's declared exports/CEM surface against the FUI impl's ACTUAL exports — the deeper content-equality the #170 hazard implies, needs a TS export parse of the resolved impl module. Mirrors #726 (the plug warn-to-enforce flip).
