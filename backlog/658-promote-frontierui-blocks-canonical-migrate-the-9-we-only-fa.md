---
type: issue
workItem: story
size: 8
status: open
blockedBy: ["657"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
tags: []
---

# Promote @frontierui/blocks canonical, migrate the 9 WE-only families, delete WE's vendored blocks/

Execute Fork 2+3 of the #641 ruling: promote frontierui/blocks to a canonical granular @frontierui/blocks sub-package (sibling of @frontierui/plugs). Migrate the 9 WE-only families that carry real impl (audit, background-task-surface, data-grid, lifecycle, master-detail, selection, stepper, tree-select, type-ahead) UP to @frontierui/blocks BEFORE deleting anything — the #170 migration-order guard (never delete a tree not yet content-equal upstream). Then delete WE's byte-identical vendored blocks/ and repoint WE demos/site to consume @frontierui/blocks as the #604 client. Per-family classification at build time: genuine impl migrates, aspirational/empty stays a blocks.json contract with no sourcePath.

## Outgrew a clean batch slice (2026-06-15, batch pre-flight) — split into ordered sub-slices, back half blocked by #604

Claimed in a batch and scoped against **both** real trees (`webeverything/blocks/`, `../frontierui/`). The decision (#641 A/A/A) is settled and #657 already did the contract side (`sourcePath` → `implementedBy` repointed to `@frontierui/blocks/…` on all 31 entries). What remains is a **multi-stage cross-repo physical migration**, not an 8-pt slice — concrete evidence, not a "looks big" guess:

- **`@frontierui/blocks` does not exist as a package.** FUI uses a `packages/*` npm-workspace layout
  (`packages/compiler`, `packages/vite-plugin`, …); `frontierui/blocks/` is a plain dir and there is **no
  `plugs/package.json`** either. Creating the canonical sub-package means following those conventions:
  a `package.json` + `exports` map, the root `workspaces` array, and `build:packages` wiring. Structural
  work in FUI's build, with its own (small) conventions to settle.
- **The delete + repoint half is large and entangled with a held item.** It deletes WE's ~21 vendored
  families, repoints **every** WE `blocks/…` import to the cross-repo `@frontierui/blocks`, and reconfigures
  WE's build (vite/tsc/module-resolution) to resolve it. The card itself frames this as *"repoint WE
  demos/site to consume @frontierui/blocks as the **#604 client**"* — and **#604 is held** (D3-readiness,
  `relatedProject: webplugs` is a `concept` project with no shipped surface; the loader demotes it out of
  Tier A). So the back half is **blocked-in-fact** until #604 is unblocked.
- **The #170 ordering guard adds per-family byte-equality verification** across both repos before any delete.

**Recommended split (`/split`)** along the agent-ready / blocked seam — the front half is the #170-safe
upstream migration, deliverable now; the back half waits on #604:

1. **S1 — Create `@frontierui/blocks` as a canonical FUI workspace sub-package** (package.json + exports +
   workspaces wiring), exporting the families FUI already owns. Agent-ready; no WE change, no delete. Small.
2. **S2 — Migrate the 9 WE-only families UP to `@frontierui/blocks`** (impl + register + tests), byte-verified,
   **without deleting WE's copies** (#170: content-equal upstream first). Agent-ready after S1. Medium.
3. **S3 — Delete WE's vendored `blocks/` + repoint all WE imports/build to `@frontierui/blocks`.**
   This **is** the #604 client migration — **blocked by #604** (held). Do not start until #604 ships.

**Released unworked (batch stop rule 4 — outgrew; back half blocked-in-fact by #604).** Independent of the
rest of the batch, so the batch continued past it. Spin S1/S2/S3 via `/split` when picked up.
