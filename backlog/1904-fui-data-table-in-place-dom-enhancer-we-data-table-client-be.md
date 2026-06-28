---
kind: story
size: 3
parent: "1600"
locus: frontierui
status: open
dateOpened: "2026-06-28"
tags: [data-table, ssr, in-place-enhancer, frontierui]
---

# FUI data-table in-place DOM enhancer (we-data-table client behavior, no re-render)

Slice B of the #1867 harness. The `we-data-table` custom-element client behavior that reorders/hides the EXISTING SSR rows on sort/filter/page by reading the raw data-* keys (`<td data-sort-value>`, `<th data-type data-sortable>`) — no re-render, no JSON island, which is what keeps the build↔client skew class structurally gone. A distinct client path from the current rebuild-from-.rows/.config CE (fui:blocks/renderers/data-table/DataTableBehavior.ts:82-100, fui:embed/data-table-in-document.ts:44-52). Independent of slice A's code — built against the ratified #1867 cell contract; demoable on a static SSR fixture. Homed in FUI (locus: frontierui).
