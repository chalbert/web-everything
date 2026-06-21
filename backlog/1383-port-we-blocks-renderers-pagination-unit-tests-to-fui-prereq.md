---
kind: story
size: 2
locus: frontierui
parent: "1353"
status: open
dateOpened: "2026-06-21"
tags: []
---

# Port we:blocks/renderers/pagination unit tests to FUI (prereq for #1356 delete)

Buried prereq found in #1356 pre-flight (batch-2026-06-20-1372-1369): deleting we:blocks/renderers/pagination would orphan its WE unit tests (we:blocks/__tests__/unit/renderers/pagination.test.ts + we:blocks/__tests__/unit/renderers/pagination-behavior.test.ts), NOT duplicated in FUI. Per #1290/#817/#855 port them to fui:blocks/renderers/pagination/__tests__ before the delete so conformance coverage survives.
