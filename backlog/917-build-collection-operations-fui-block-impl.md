---
kind: story
size: 3
parent: "904"
status: resolved
locus: frontierui
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: frontierui/blocks/renderers/collection-operations/CollectionOperationsBehavior.ts
tags: []
---

# Build collection-operations FUI block impl

Build the headless collection-operations coordinator in `fui:blocks/renderers/collection-operations/` (contract: we:src/_data/blocks/collection-operations.json). Reuse data-table applyPipeline to run filter/sort/group across the whole set, then window the page slice; ship CollectionOperationsBehavior + optional headless `<collection-operations>` routing data-table-change/pagination-change and emitting collection-operations-change. Composed deps (`fui:blocks/renderers/data-table/`, `fui:blocks/renderers/pagination/`) exist. locus frontierui. Slice of #904 (#452 resolved).

## Built (batch-2026-06-18)

Headless coordinator shipped in **frontierui** at `blocks/renderers/collection-operations/`:

- **`fui:windowCollection.ts`** — the pure page stage: runs the data-table's verified `applyPipeline`
  (filter→sort→group) across the ENTIRE collection, then windows the ordered result to the current
  page (clamps over-far indices; re-projects groups onto the window keeping collection-wide
  summaries). Reuses `applyPipeline` whole — re-implements none of the contract. Fixes the
  page-then-sort bug #317 surfaced.
- **`fui:CollectionOperationsBehavior.ts`** — `CollectionOperationsBehavior` (event wiring: routes
  descendant `data-table-change` → re-run pipeline + reset to page 0; `pagination-change` →
  re-window; feeds `pageRows`→data-table `.rows` + `total`→pagination `setTotal`; emits
  `collection-operations-change`) + the headless `<collection-operations>` element
  (`CollectionOperationsModule`) + idempotent `registerCollectionOperations`. Renders no DOM.
- Exported from `fui:blocks/renderers/index.ts`. Exports match the contract
  (`CollectionOperationsModule`, `CollectionOperationsBehavior`, `registerCollectionOperations`).

Per #452 (A/A): standalone headless machinery, not a documented composition, not a rendered block.
Gate: `check:standards` green (0 errors), 10 new vitest specs pass, `tsc --noEmit` clean.
