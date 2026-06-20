---
kind: story
size: 3
parent: "658"
locus: frontierui
status: resolved
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
tags: []
---

# Create @frontierui/blocks as a canonical FUI workspace sub-package

S1 of #658. Create @frontierui/blocks as a granular FUI workspace sub-package (sibling of the future @frontierui/plugs): a we:package.json + exports map covering the 14 families FUI already owns (attributes, droplist, for-each, navigation, parsers, renderers, resource-loader, router, stores, tabs, text-nodes, traits, transient, view), add "blocks" to the root workspaces array (the existing top-level compiler precedent — blocks/ stays at FUI root, not under packages/), and wire build. FUI-only — no WE change, no delete. Executes Fork 2 of the #641 ruling.

## Progress

Resolved 2026-06-15. FUI-only, all changes in `../frontierui`:

- **`fui:blocks/package.json`** — new `@frontierui/blocks@0.1.0` (`private`, `type: module`). Exports map covers all 14 families: a bare entry (`./<family>` → `./<family>we:/index.ts`) for the 10 that already ship an index barrel, plus a deep-import wildcard (`./<family>/*`) for all 14 (the 4 index-less families — attributes, droplist, parsers, traits — are reachable via the wildcard; their bare barrels are deferred to the #658 promotion, no new files invented here). Exports point at **source `.ts`** — blocks is consumed in-repo as source (root `tsconfig` includes `blocks/**/*`) and `@frontierui/plugs` isn't carved yet, so a standalone dist build can't resolve the `@core/*`/`@webcomponents/*` plugs aliases. Source exports are the honest foundation; dist wiring follows when plugs ships.
- **`fui:blocks/tsconfig.json`** — scoped config extending root with `baseUrl: ".."` (so the plugs path aliases still resolve from source) + `noEmit: true`; `build` = `tsc -p we:tsconfig.json` typecheck, so the package participates in the workspace build graph without emitting dead JS.
- **root `we:package.json`** — added `"blocks"` to `workspaces` (sibling of `compiler`, the top-level precedent; blocks/ stays at FUI root, not under `packages/`).

Locus was unset on this card — set `locus: frontierui` (it edits `../frontierui` only).

Verification (in `../frontierui`): `npm run build -w @frontierui/blocks` resolves the workspace + typechecks clean; `npm run check:standards` = 0 errors; `npm run test:unit` = 1550 passed / 8 skipped (102 files), unchanged from baseline.
