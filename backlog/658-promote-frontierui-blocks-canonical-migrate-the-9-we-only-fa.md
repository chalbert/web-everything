---
type: issue
workItem: epic
status: resolved
blockedBy: ["657"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-17"
graduatedTo: "@frontierui/blocks (canonical granular block-impl workspace sub-package; 9 WE-only families migrated UP, WE's vendored runtime deleted, reference-runtime subset + @webeverything/contracts type-halves retained)"
tags: []
---

# Promote @frontierui/blocks canonical, migrate the 9 WE-only families, delete WE's vendored blocks/

Execute Fork 2+3 of the #641 ruling: promote frontierui/blocks to a canonical granular @frontierui/blocks sub-package (sibling of @frontierui/plugs). Migrate the 9 WE-only families that carry real impl (audit, background-task-surface, data-grid, lifecycle, master-detail, selection, stepper, tree-select, type-ahead) UP to @frontierui/blocks BEFORE deleting anything — the #170 migration-order guard (never delete a tree not yet content-equal upstream). Then delete WE's byte-identical vendored blocks/ and repoint WE demos/site to consume @frontierui/blocks as the #604 client. Per-family classification at build time: genuine impl migrates, aspirational/empty stays a fui:blocks.json contract with no sourcePath.

## Outgrew a clean batch slice (2026-06-15, batch pre-flight) — split into ordered sub-slices, back half blocked by #604

Claimed in a batch and scoped against **both** real trees (`webeverything/blocks/`, `../frontierui/`). The decision (#641 A/A/A) is settled and #657 already did the contract side (`sourcePath` → `implementedBy` repointed to `@frontierui/blocks/…` on all 31 entries). What remains is a **multi-stage cross-repo physical migration**, not an 8-pt slice — concrete evidence, not a "looks big" guess:

- **`@frontierui/blocks` does not exist as a package.** FUI uses a `packages/*` npm-workspace layout
  (`packages/compiler`, `packages/vite-plugin`, …); `frontierui/blocks/` is a plain dir and there is **no
  `we:plugs/package.json`** either. Creating the canonical sub-package means following those conventions:
  a `we:package.json` + `exports` map, the root `workspaces` array, and `build:packages` wiring. Structural
  work in FUI's build, with its own (small) conventions to settle.
- **The delete + repoint half is large and entangled with a held item.** It deletes WE's ~21 vendored
  families, repoints **every** WE `blocks/…` import to the cross-repo `@frontierui/blocks`, and reconfigures
  WE's build (vite/tsc/module-resolution) to resolve it. The card itself frames this as *"repoint WE
  demos/site to consume @frontierui/blocks as the **#604 client**"* — and **#604 is held** (D3-readiness,
  `relatedProject: webplugs` is a `concept` project with no shipped surface; the loader demotes it out of
  Tier A). So the back half is **blocked-in-fact** until #604 is unblocked.
- **The #170 ordering guard adds per-family byte-equality verification** across both repos before any delete.

## Sliced into 5 children (2026-06-15, `/split 658`)

Verified against both real trees (see `we:reports/2026-06-15-backlog-split-analysis.md`) and split along the
agent-ready / blocked seam. This card is now a **storied epic**; its scope lives in the children. S2 was
refined into 3 batchable units by the real file/test surface. DAG: `S1 → {S2a ∥ S2b ∥ S2c} → S3`, and
S3 also `blockedBy #604`.

- **#693 — S1.** Create `@frontierui/blocks` as a canonical FUI workspace sub-package (we:package.json +
  exports + the `"blocks"` workspaces entry, the top-level `compiler` precedent), exporting the 14
  FUI-owned families. FUI-only; no WE change, no delete. `story · 3` — agent-ready now.
- **#694 — S2a.** Migrate the 6 single-file WE-only families (`audit`, `lifecycle`, `master-detail`,
  `selection`, `stepper`, `tree-select`) UP, byte-verified, WE copies kept (#170 guard). `task · 3`,
  blockedBy #693.
- **#695 — S2b.** Migrate `background-task-surface` UP (12 files incl. 6 traits + fixtures + tests),
  byte-verified, WE copy kept. `story · 3`, blockedBy #693.
- **#696 — S2c.** Migrate `data-grid` + `type-ahead` UP, byte-verified, WE copies kept. `story · 3`,
  blockedBy #693.
- **#697 — S3.** Delete WE's vendored `blocks/` + repoint every WE import/build to `@frontierui/blocks`
  (the #604 client cutover). `story · 8` — **not batchable**, blockedBy #694/#695/#696 **and #604**
  (held). Re-`/split` once #604 lands (its two open forks decide *how* WE resolves the package, so S3's
  own sub-seams aren't investigable yet).

## Second-wave children — epic NOT done (2026-06-17)

S1+S2 are all resolved (#693/#694/#695/#696). S3 (#697) resolved too, but its cutover was reconciled
against the #604 iframe boundary (#791) and the app-coupled deletion carved out into a new sub-DAG.
Three children are still live, so the umbrella stays **open**:

- **#823 — epic, open** (`locus: frontierui`). Move the two flagship exercise apps (loan-origination
  #317 + auto-insurance #318) to FUI — #812 Fork-1(a) execution. Prerequisite gating the app-coupled
  deletion.
- **#824 — story · 5, open**, blockedBy #823. Delete WE's 6 app-coupled block-impl families
  (audit/lifecycle/master-detail/selection/stepper/tree-select) after the apps move to FUI.
- **#870 — story · 5, active** (`locus: frontierui`). Build the must-build FUI chrome blocks
  (app-shell, sectioned-disclosure nav, button) for the WE-docs dogfood.

Resolve this epic only once #823, #824, and #870 are all resolved (no-open-slice guard).
