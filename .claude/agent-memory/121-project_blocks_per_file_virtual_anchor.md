---
name: project_blocks_per_file_virtual_anchor
description: "blocks.json was split into per-file src/_data/blocks/<id>.json (#882); the file is GONE but blocks.json#<id> survives as a virtual graduatedTo anchor — don't edit/flag the old path"
metadata: 
  node_type: memory
  type: project
  originSessionId: 14ac1501-0cac-456e-9cd6-6aa9630ea146
---

#882 (resolved 2026-06-18) split the monolithic `src/_data/blocks.json` into **one file per block** at `src/_data/blocks/<id>.json` (78 files), assembled into the `blocks` array by `scripts/lib/blocks-loader.cjs` (glob + id-sort, deterministic) — consumed by both the 11ty loader `src/_data/blocks.js` (CJS) and every `.mjs` script/test (ESM default/named import of the `.cjs`). Mirrors `backlog.js`. The #657 field set (the contract) and the assembled-array shape are unchanged — this was purely internal file granularity.

Two footguns for future sessions:
- **`src/_data/blocks.json` no longer exists.** To edit a block's spec, edit its `src/_data/blocks/<id>.json`. Any code reading `blocks.json` directly is a bug — route through `loadBlocks()` (the assembler). Empirically verified on Eleventy v2: `blocks.js` loader + sibling `blocks/` dir do NOT collide on the `blocks` key (loader wins).
- **`blocks.json#<id>` is still a VALID virtual anchor** in backlog `graduatedTo` fields (a stable cross-backlog contract). The grammar stays even though the file is gone; the block id-set behind it now comes from the per-file dir (`normalize-graduated.mjs` + `buildGraduatedKinds`). Do NOT flag these anchors as broken or migrate them.

Autofix write-target (Wrinkle 1): a Block status fixer's descriptor `file` resolves per-id via `fileFor('Block', id)`/`blockSpecFile(id)` in `check-standards-rules.mjs` → patches the small `blocks/<id>.json`, not a monolith. B2 (co-locating spec+description under `blocks/<id>/`) stays a cheap future option but was deferred — the spec is registry/contract data that belongs in the `_data/` layer with the other registries; co-location would pull the njk off its `_includes/` rail. See [[project_backlog_bodyless_relatedreport_footgun]] for the related graduatedTo grammar.
