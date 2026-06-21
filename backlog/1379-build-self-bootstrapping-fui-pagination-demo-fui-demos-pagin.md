---
kind: story
size: 3
locus: frontierui
parent: "1353"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "fui:demos/pagination-demo.html"
tags: []
---

# Build self-bootstrapping FUI pagination demo (fui:demos/pagination-demo.html)

Prereq for #1356 swap+delete: fui:demos/pagination-demo.html does not exist yet. Build a self-bootstrapping FUI pagination renderer demo, browser-verify on :3001. The #1312-analog the #1326 size-3 delete+swap precedent had as a separate prior item.

## Progress (batch-2026-06-20-1372-1369)

Done. Identical pattern to #1378: FUI's `fui:blocks/renderers/pagination/renderPagination.ts` exposes the
same `renderPagination`/`auditPagination`/`AuditResult` + `paginationCases`/`PaginationCase` fixtures as WE,
and the harness/CSS paths resolve in FUI — so copied `we:demos/pagination-demo.{html,ts,css}` →
`fui:demos/pagination-demo.{html,ts,css}` (self-bootstrapping, zero import changes).

**Browser-verified on :3001 (Playwright):** all **6/6** cases render `✓ conformant` (summary `pass`, 6 pass /
0 fail); no console/page errors. FUI `check:standards` 0 errors. (`pagination` is a renderer, not a FUI
catalog block — no `blocks.json`/`DEMO_PENDING` wiring; the WE-side swap+delete is the parent #1356, now
unblocked.)
