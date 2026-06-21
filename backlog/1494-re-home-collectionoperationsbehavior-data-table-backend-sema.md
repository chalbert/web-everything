---
kind: story
size: 5
parent: "1353"
status: open
blockedBy: []
dateOpened: "2026-06-21"
tags: []
---

# Re-home CollectionOperationsBehavior + data-table backend semantics to FUI (per #1467/#899); WE keeps verifier + vectors + types

Per ratified #1467 (→ b) under #899's vector-conformance split, the data-table runnable backend is impl →
FUI. Move `renderDataTable`/`cellContent`/`cellDisplayText` + the backend semantics
`applyPipeline`/`aggregate`/`summaryText`/sort-state/`announce` out of
`we:blocks/renderers/data-table/renderDataTable.ts` to FUI, and re-home the
`we:blocks/renderers/collection-operations/CollectionOperationsBehavior.ts` coordinator (it value-imports
`applyPipeline, aggregate`). WE keeps the contract **types** + the vector corpus
(`we:blocks/renderers/data-table/__fixtures__/data-table-cases.ts`) + the `auditDataTable` assertion-
semantics **verifier**, which asserts the stored golden output as data (no live WE render). This is the
prereq that unblocks #1355's renderer delete — file #1355 `blockedBy` this.

## Acceptance

- `we:blocks/renderers/collection-operations/CollectionOperationsBehavior.ts` no longer value-imports from
  `we:blocks/renderers/data-table/` (coordinator + its conformance live in FUI, or it consumes the FUI backend).
- `we:blocks/renderers/data-table/renderDataTable.ts` reduced to types + verifier; backend + semantics gone to FUI.
- WE conformance suite (`we:blocks/__tests__/unit/renderers/data-table.test.ts`) asserts `auditDataTable`
  against the stored vector golden output — green without importing a WE `renderDataTable`.
- `npm run check:standards` green in both repos; FUI gate green for the moved backend.
