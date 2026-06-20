---
type: issue
workItem: epic
status: open
dateOpened: "2026-06-18"
relatedReport: reports/2026-06-18-backlog-split-analysis.md
tags: []
---

# FUI block-impl backfill + drift enforcement — umbrella for the 10 missing block impls + gate flip + export-shape arm

> **Sliced into a storied epic (2026-06-18, `/slice`).** This was a `story · size 13`; its claim-time
> investigation found the 10 block impls were never built (not moved), so the real deliverable is
> **building 10 FUI block impls** (`locus: frontierui`) then closing the gate. Each block impl is
> independently deliverable, so it sliced cleanly. Umbrella for: 10 per-block builds → flip
> `BLOCK_IMPL_DRIFT_ENFORCED` → add the export-shape gate arm. Per-slice scope lives in the children
> (#A–#L). The body below is the spec. **DAG:** `data-transfer → code-view`, `workflow-engine → wizard`;
> the other 6 block builds are independent roots; the flip + export-arm wait on all 10.
> Split rationale + slice table: `we:reports/2026-06-18-backlog-split-analysis.md`.
>
> _Dropped `parent: "170"` on slice: #170 is the **plugs-runtime** dedup epic; this is **block-impl**
> drift — a cited analogue (the gate carries "#170/#659"), not within #170's plugs scope. Kept as a
> lineage cross-reference only, not a parent edge._

# Close the 10 block contract-impl drift gaps in FUI + flip BLOCK_IMPL_DRIFT_ENFORCED + add export-shape arm

The #659 drift gate (validateBlockImplConformance) WARNs on 10 blocks whose implementedBy points at a FUI impl that does not resolve in ../frontierui (code-view, collection-operations, data-transfer, draft-persistence, props-table, reorderable-list, rich-text-editor, story-canvas, wizard, workflow-engine). Build those FUI impls (locus frontierui) or correct the references, then flip BLOCK_IMPL_DRIFT_ENFORCED=true in we:scripts/check-standards-rules.mjs so a moved/deleted impl hard-fails (the #726 analogue for blocks).

Second arm (deferred from #659, which shipped impl-existence only): extend the gate to compare each block's declared exports/CEM surface against the FUI impl's ACTUAL exports — the deeper content-equality the #170 hazard implies, needs a TS export parse of the resolved impl module. Mirrors #726 (the plug warn-to-enforce flip).

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

## Export-shape arm sliced (2026-06-19, `/slice 927` — `we:reports/2026-06-19-backlog-split-analysis.md`)

`/slice 927` found the export-shape arm doesn't split into multiple build slices — the warn-first resolver
is atomic (re-export following must ship with the first gather) and the rest is decisions, not volume. So
#927 was **re-sized 13 → 5** (the barrel-scoped warn-first arm) and its two embedded forks were **de-buried**
into sibling decision children:

- **#1164** — renderer-block export-shape coverage (5 no-barrel renderer blocks: dir-walk vs FUI barrels vs exempt).
- **#1165** — resolve the 3 export-shape drift findings (`tabs`/`transient-component`/`view`): correct contract vs FUI build.

Both surface warn-first via #927 and are the prerequisites (with #927) to flipping `EXPORT_SHAPE_ENFORCED`.
