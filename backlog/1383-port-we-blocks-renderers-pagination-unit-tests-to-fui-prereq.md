---
kind: story
size: 2
locus: frontierui
parent: "1353"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "frontierui:blocks/renderers/pagination/__tests__/pagination.test.ts"
tags: []
---

# Port we:blocks/renderers/pagination unit tests to FUI (prereq for #1356 delete)

Buried prereq found in #1356 pre-flight (batch-2026-06-20-1372-1369): deleting we:blocks/renderers/pagination would orphan its WE unit tests (we:blocks/__tests__/unit/renderers/pagination.test.ts + we:blocks/__tests__/unit/renderers/pagination-behavior.test.ts), NOT duplicated in FUI. Per #1290/#817/#855 port them to fui:blocks/renderers/pagination/__tests__ before the delete so conformance coverage survives.

## Progress (2026-06-21, batch-2026-06-21-1385-1392)

- Ported both WE suites → `fui:blocks/renderers/pagination/__tests__/pagination.test.ts` (renderer, 14 tests)
  + `fui:blocks/renderers/pagination/__tests__/pagination-behavior.test.ts` (behavior, 8 tests) over the
  FUI renderer/behavior impl. **22 tests pass; FUI gate green.**
- FUI deltas adapted: the declarative element is `PaginationModule` (FUI export) registered under the
  WE-spec tag `we-pagination` (the WE source used the `page-nav` default); all renderer/audit/announce/
  rangeText APIs are name-identical so the rest ported verbatim. FUI `announcePagination` produces the same
  "Page 3 of 10; Showing 101–150 of 500." string the WE suite asserts.
- Coverage now survives the eventual we:blocks/renderers/pagination delete (#1356 unblocked on this prereq).
