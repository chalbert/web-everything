---
type: issue
workItem: story
size: 13
parent: "170"
status: open
dateOpened: "2026-06-18"
tags: []
---

# Close the 10 block contract-impl drift gaps in FUI + flip BLOCK_IMPL_DRIFT_ENFORCED + add export-shape arm

The #659 drift gate (validateBlockImplConformance) WARNs on 10 blocks whose implementedBy points at a FUI impl that does not resolve in ../frontierui (code-view, collection-operations, data-transfer, draft-persistence, props-table, reorderable-list, rich-text-editor, story-canvas, wizard, workflow-engine). Build those FUI impls (locus frontierui) or correct the references, then flip BLOCK_IMPL_DRIFT_ENFORCED=true in we:scripts/check-standards-rules.mjs so a moved/deleted impl hard-fails (the #726 analogue for blocks). Second arm (deferred from #659, which shipped impl-existence only): extend the gate to compare each block's declared exports/CEM surface against the FUI impl's ACTUAL exports — the deeper content-equality the #170 hazard implies, needs a TS export parse of the resolved impl module. Mirrors #726 (the plug warn-to-enforce flip).

## Resized 5 → 13, released (batch-2026-06-18 — not a batch task)

Investigated at claim: **all 10** blocks' `implementedBy` targets resolve to **nothing** in
`../frontierui/blocks/` — not moved or renamed (a `find -iname` for each id across the FUI blocks tree
returned zero hits), they were simply **never built**. So the "or correct the references" path does not
apply — there is no impl to point at. The real deliverable is therefore **building 10 FUI block
implementations** (code-view, collection-operations, data-transfer, draft-persistence, props-table,
reorderable-list, rich-text-editor, story-canvas, wizard, workflow-engine) — several are substantial
components (rich-text-editor, workflow-engine, wizard, story-canvas), each needing its own design. That
is a `locus: frontierui` product effort well past a size-5 batch task, and `BLOCK_IMPL_DRIFT_ENFORCED`
**cannot** flip until the impls exist (flipping now would hard-fail the gate on 10 genuine gaps — the
exact warn-ahead state the gate was designed for). The export-shape comparison arm (arm 2) likewise
needs the impls present to parse their exports, so it cascades from the build.

**Next:** resized to 13 (drops from the batch pool) and re-homed conceptually to FUI. Should be
`/slice`d into per-block (or per-cluster) build items — each block impl is independently deliverable —
before the gate flip + export-shape arm land as the closing slices. Left `BLOCK_IMPL_DRIFT_ENFORCED=false`.
