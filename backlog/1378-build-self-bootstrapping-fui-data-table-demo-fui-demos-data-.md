---
kind: story
size: 3
locus: frontierui
parent: "1353"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "fui:demos/data-table-demo.html"
tags: []
---

# Build self-bootstrapping FUI data-table demo (fui:demos/data-table-demo.html)

Prereq for #1355 swap+delete: fui:demos/data-table-demo.html does not exist yet. Build a self-bootstrapping FUI data-table renderer demo faithfully reproducing we:demos/data-table-demo.ts (216 lines), browser-verify on :3001. The #1312-analog the #1326 size-3 delete+swap precedent had as a separate prior item.

## Progress (batch-2026-06-20-1372-1369)

Done. FUI's `fui:blocks/renderers/data-table/renderDataTable.ts` exposes a **byte-identical public API** to
WE's (`renderDataTable`/`auditDataTable`/`applySortClick`/`announce` + `DataTableConfig`/`Row`/`AuditResult`)
and FUI already ships `fui:demos/playground-harness.ts` + `playground.css` + the `__fixtures__/data-table-cases`
at the same `/blocks/...` and `/demos/...` paths — so the WE playground reproduces faithfully against the FUI
renderer with zero import changes. Copied `we:demos/data-table-demo.{html,ts,css}` →
`fui:demos/data-table-demo.{html,ts,css}` (self-bootstrapping, absolute imports resolve in FUI).

**Browser-verified on :3001 (Playwright):** all **9/9** cases render `✓ conformant` (summary `pass`, 9 pass /
0 fail badges); the interactive card's header click cycles `aria-sort` and announces *"Sorted by Name,
descending; 6 rows."*; no console/page errors. FUI `check:standards` 0 errors. (`data-table` is a renderer,
not a FUI catalog block, so no `blocks.json`/`DEMO_PENDING` wiring — the WE-side swap+delete is the parent
#1355, now unblocked.)
