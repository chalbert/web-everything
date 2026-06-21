---
kind: story
size: 3
locus: frontierui
parent: "1353"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "frontierui:blocks/renderers/data-table/__tests__/data-table.test.ts"
tags: []
---

# Port we:blocks/renderers/data-table unit tests to FUI (prereq for #1355 delete)

Buried prereq found in #1355 pre-flight (batch-2026-06-20-1372-1369): deleting we:blocks/renderers/data-table would orphan its WE unit tests (we:blocks/__tests__/unit/renderers/data-table.test.ts + we:blocks/__tests__/unit/renderers/data-table-behavior.test.ts + we:blocks/__tests__/unit/renderers/collection-operations.test.ts) which are NOT duplicated in FUI (fui:blocks/__tests__/unit/renderers/ has only JSXRenderer; fui has collection-operations co-located tests only). Per #1290/#817/#855 (runtime+tests→FUI) port the renderer unit tests to fui:blocks/renderers/data-table/__tests__ (adapt to the FUI renderer) so coverage survives the delete. No separate we:src/cases vector exists.

## Progress (2026-06-21, batch-2026-06-21-1385-1392)

- Ported the two data-table suites → `fui:blocks/renderers/data-table/__tests__/data-table.test.ts`
  (renderer + pipeline/aggregate/announce helpers, 34 tests) + `…/data-table-behavior.test.ts` (behavior,
  4 tests). **38 tests pass verbatim** — the FUI renderer matches the WE APG/Intl.Collator/SQL-aggregate
  contract exactly (markup, group `tbody[data-group]`, `aria-sort`, summary wording, live announce). FUI
  gate green.
- Behavior FUI deltas: `DataTableModule` (FUI export) under the WE-spec tag `we-data-table` (WE source
  used `data-table`); renderer test ported with no logic change, only import paths.
- **`collection-operations.test.ts` deliberately NOT ported** — it is NOT orphaned. The WE file targets an
  older WE `CollectionOperationsBehavior` API (`{rows,config,pageSize}` + `CollectionWindow`); the FUI impl
  evolved to a `windowCollection` + event-wiring shape and **already carries equivalent coverage** of the
  same whole-book-then-window contract (#369) in
  `fui:blocks/renderers/collection-operations/__tests__/collectionOperations.test.ts` (windowing across the
  whole collection before paging, event re-window). Porting the WE version would duplicate covered ground
  against a non-existent API. Coverage survives the delete without it.
