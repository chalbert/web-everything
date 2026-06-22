---
kind: story
size: 2
parent: "1353"
status: resolved
locus: webeverything
blockedBy: []
relatedReport: reports/2026-06-22-backlog-split-analysis.md
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "fui:blocks/renderers/collection-operations/"
tags: []
---

# Delete the WE CollectionOperationsBehavior coordinator + its WE test (FUI hosts it; only WE consumer is its own test)

Per #1467(→b)/#899: delete we:blocks/renderers/collection-operations/CollectionOperationsBehavior.ts + we:blocks/__tests__/unit/renderers/collection-operations.test.ts. FUI already hosts the coordinator (fui:blocks/renderers/collection-operations/). Investigation: nothing in WE imports it except its own test — the collection-operations refs in we:demos/pagination-demo.html (line 28) + we:demos/data-table-demo.html (line 28) are `<a href>` doc links to the /intents/collection-operations/ route, and registerCollectionOperations is never called outside the test. Self-contained green delete (removes a renderer consumer). Carved from #1494 per we:reports/2026-06-22-backlog-split-analysis.md (Run 4). blockedBy [] — batchable now.
