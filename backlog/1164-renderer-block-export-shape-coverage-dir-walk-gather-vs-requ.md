---
type: decision
workItem: story
size: 3
parent: "904"
status: open
dateOpened: "2026-06-20"
tags: []
---

# Renderer-block export-shape coverage: dir-walk gather vs require FUI barrels vs exempt

De-buried from #927 (it left this as "decide it when (b) lands"). The export-shape arm (#927) can't
verify the **5 renderer blocks** — `collection-operations` / `data-grid` / `data-table` / `pagination` /
`reorderable-list` keep a **dir-style `implementedBy`** under `fui:blocks/renderers/<id>/` (e.g.
`@frontierui/blocks/renderers/data-grid/`) and that dir holds only leaf modules with **no barrel**
(no `fui:blocks/renderers/data-grid/index.ts` etc.) (verified 2026-06-19). So there is no enumerable module surface for the resolver to compare the
declared `we:` `exports` against.

## Fork — how the resolver covers the renderer blocks

- **A — gather walks the dir's leaf modules.** The resolver enumerates every `*.ts` under the renderer
  dir and unions their named exports. Keeps `implementedBy` dir-style; no FUI change. Risk: a dir-walk
  surface is looser than a curated barrel (picks up internal helpers as "exports").
- **B — require FUI to add a `fui:blocks/renderers/data-grid/index.ts`-style barrel per renderer** (5 small `locus: frontierui` builds), then
  re-point each `implementedBy` at the barrel (the #948 pattern). Curated surface; symmetric with the
  other 7 blocks. Cost: 5 FUI edits + 5 contract re-points.
- **C — exempt renderers from the export-shape arm** (the arm logs them as out-of-scope). Cheapest;
  leaves renderer export-drift unguarded.

**Recommended default (low confidence): B** — it makes the renderer surface curated and symmetric with
the #948-aligned barrel blocks, so the arm enforces uniformly; the dir-walk (A) re-introduces exactly the
"can't tell export from internal" looseness #948 worked to remove. Revisit if the 5 FUI barrels prove
disproportionate.

**Relationship to #927:** does NOT block #927's arm — that ships warn-first scoped to the 7 barrel blocks
and logs renderers as un-coverable. This decision gates extending the arm to renderers + the eventual
`EXPORT_SHAPE_ENFORCED` flip. Slice of #904.
