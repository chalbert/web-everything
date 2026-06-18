---
type: issue
workItem: task
parent: "658"
status: resolved
blockedBy: ["693"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: frontierui/blocks/renderers/data-grid/renderDataGrid.ts
tags: []
---

# Migrate renderers/data-grid up to @frontierui/blocks (S2c-pre)

S2c precursor of #658, surfaced by #696. blocks/data-grid imports ../renderers/data-grid/renderDataGrid, which is WE-only and absent from @frontierui/blocks — so #696's byte-copy would dangle and break FUI's build. Migrate the renderers/data-grid render family (fui:renderDataGrid.ts, fui:editableGrid.ts, __fixtures__) UP to @frontierui/blocks first, byte-identical, WITHOUT deleting WE's copy (#170 guard), add to the S1 exports map. Apply the option-A type-harden (#695) if FUI's stricter tsc flags a latent type issue. Then #696 (S2c) is a clean byte-copy.

## Progress

- **2026-06-15 — migrated.** Byte-identical copies of `fui:renderDataGrid.ts`, `fui:editableGrid.ts`, and both
  `__fixtures__/` cases into `frontierui/blocks/renderers/data-grid/` (verified `diff -q` clean against the
  WE originals; WE copies untouched, #170 guard). The family is self-contained — only intra-family relative
  type imports, no external deps to drag along.
- **Exports map:** no change needed. Unlike the #694 single-file *top-level* families, this family nests
  under the already-exported `renderers` subpath — `@frontierui/blocks/renderers/*` (named + wildcard)
  already resolves `.../renderers/data-grid/renderDataGrid`, and #696's consumer reaches it via the
  package-relative `../renderers/data-grid/...` import.
- **Gate:** FUI's stricter `tsc -p fui:blocks/tsconfig.json --noEmit` is **clean** — no latent type issue, so
  the #695 option-A harden was not required. #696 (S2c) is now a clean byte-copy.
