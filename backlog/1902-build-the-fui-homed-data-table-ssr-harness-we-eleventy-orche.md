---
kind: story
size: 8
parent: "1600"
locus: frontierui
status: open
dateOpened: "2026-06-28"
tags: [data-table, ssr, build-integration, frontierui]
---

# Build the FUI-homed data-table SSR harness + WE Eleventy orchestration (per #1867 ruling)

Implements the ratified #1867 design (`we:docs/agent/platform-decisions.md#ssr-data-table-build-harness`). **Three components, slice candidate** (split via `/slice` before batching — size 8):

1. **FUI build-CLI** — keyed-batch stdin/stdout, version-pinned (locked FUI build-artifact, never PATH-resolved); `evaluate()` the deterministic context, then `renderDataTable()` to an SSR `<table>` whose interactive cells carry **raw `data-*` sort keys** (`<td data-sort-value>`, `<th data-type data-sortable>`) — not reparsed display text. Homed in **FUI** (`locus: frontierui`).
2. **FUI in-place DOM enhancer** — the `we-data-table` custom-element client behavior that reorders/hides the **existing** rows on sort/filter/page by reading the `data-*` keys; **no re-render, no JSON island** (this is what keeps the build↔client skew class structurally gone).
3. **WE Eleventy orchestration** — detect a `we-data-table` `rows` web-expression binding, gather the deterministic build context, shell out to the FUI CLI over the subprocess boundary, splice the returned SSR HTML. The build **never** reads the dev `/_maas/data/` route.

Prerequisite for the #1600 table→data-table family ([#1609](/backlog/1609-migrate-table-surfaces-in-we-src-includes-project-to-fui-dat/)–[#1613](/backlog/1613-migrate-table-surfaces-in-we-src-includes-research-descripti/)), which `blockedBy` this. The non-deterministic app case is #1827.
