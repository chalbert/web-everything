---
kind: decision
status: open
blockedBy: []
dateOpened: "2026-06-21"
tags: [decision, renderers, conformance, webblocks, constellation]
---

# Disposition of WE reference renderers (data-table/pagination) — deletable per #1353, or kept as WE conformance references + CollectionOperationsBehavior dependency?

Blocks #1355 / #1356. Those cards (slices of #1353) assume the #1326 clean delete+swap: build the FUI
demo, swap the WE page to a #701 iframe, **delete** `we:blocks/renderers/data-table` /
`we:blocks/renderers/pagination`. The #1353 split analysis justified batching all three on "no shared
importer" — **that premise is false** (verified 2026-06-21):

- `we:blocks/renderers/collection-operations/CollectionOperationsBehavior.ts` **hard-imports both**:
  `applyPipeline, aggregate` (value import) from `../data-table/renderDataTable` (L26) and `PageState`
  (type) from `../pagination/renderPagination` (L27). Deleting either renderer breaks WE compilation of
  CollectionOperationsBehavior (a WE runtime file NOT in scope of the delete).
- Both renderers are also the **shared CI conformance reference** the demo + audit run
  (`we:blocks/__tests__/unit/renderers/data-table*.test.ts`,
  `we:blocks/__tests__/unit/renderers/pagination*.test.ts`,
  `we:blocks/__tests__/unit/renderers/collection-operations.test.ts`), and
  `we:src/_data/demos/data-table-demo.json` describes the renderer
  as "a deterministic *reference*; concrete strategies live in Frontier UI."

So the renderers are NOT pure delivery runtime (the #1326 case) — they are a conformance reference + an
in-WE dependency of the collection-operations coordinator. The fork:

- **(a) Keep them in WE as conformance references** (the demo PAGE still swaps to the FUI iframe for the
  *interactive* surface, but the WE renderer/fixtures stay as the conformance source) — #1355/#1356 reduce
  to demo-page-swap only, no renderer delete.
- **(b) Delete them per #1353**, which first requires re-homing CollectionOperationsBehavior's dependency
  (move the coordinator + its conformance to FUI, or have it consume the FUI renderer) and relocating the
  conformance reference — a larger constellation move, not a clean per-demo slice.

Default lean: **(a)** — a reference renderer consumed by a WE conformance suite + a WE coordinator is not
the zero-runtime-delivery case #1245/#1326 targeted; the demo-page iframe swap is the safe, deliverable
part. Resolve, then re-scope #1355/#1356 accordingly. Surfaced while working #1355 in batch-2026-06-21.
</content>
