---
kind: story
size: 3
locus: frontierui
parent: "1353"
status: open
dateOpened: "2026-06-21"
tags: []
---

# Port we:blocks/renderers/data-table unit tests to FUI (prereq for #1355 delete)

Buried prereq found in #1355 pre-flight (batch-2026-06-20-1372-1369): deleting we:blocks/renderers/data-table would orphan its WE unit tests (we:blocks/__tests__/unit/renderers/data-table.test.ts + we:blocks/__tests__/unit/renderers/data-table-behavior.test.ts + we:blocks/__tests__/unit/renderers/collection-operations.test.ts) which are NOT duplicated in FUI (fui:blocks/__tests__/unit/renderers/ has only JSXRenderer; fui has collection-operations co-located tests only). Per #1290/#817/#855 (runtime+tests→FUI) port the renderer unit tests to fui:blocks/renderers/data-table/__tests__ (adapt to the FUI renderer) so coverage survives the delete. No separate we:src/cases vector exists.
