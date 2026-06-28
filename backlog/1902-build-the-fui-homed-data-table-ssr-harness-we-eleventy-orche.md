---
kind: story
size: 5
parent: "1600"
locus: frontierui
status: open
dateOpened: "2026-06-28"
relatedReport: reports/2026-06-28-backlog-split-analysis.md
tags: [data-table, ssr, build-integration, frontierui]
---

# Build the FUI data-table build-CLI (evaluate → render → SSR `<table>` with raw cell keys) (per #1867 ruling)

Slice A of the #1867 harness (sliced 2026-06-28 — `we:reports/2026-06-28-backlog-split-analysis.md`). Build the **FUI-homed build-CLI** the WE Eleventy build shells out to: keyed-batch stdin/stdout, version-pinned (locked FUI build-artifact, never PATH-resolved). It `evaluate()`s the deterministic context (`fui:plugs/webexpressions/CustomExpressionParser.ts:42-47`), then `renderDataTable()` (`fui:blocks/renderers/data-table/renderDataTable.ts:333`, DOM-only — run under the existing `happy-dom` shim, `fui:vitest.config.ts:12`, and serialize) to an SSR `<table>` whose interactive cells carry **raw `data-*` sort keys** (`<td data-sort-value>`, `<th data-type data-sortable>`) — not reparsed display text. The renderer has no string variant and does not yet stamp per-cell raw keys, so this extends it to emit the cell text **and** its `data-*` raw value from one resolved-row projection (the #1867 residual-risk mitigation). Homed in **FUI** (`locus: frontierui`).

The CLI's keyed-array stdin/stdout contract is the seam slice C (#1905, WE orchestration) shells out to. Demoable standalone via a FUI vitest fixture (keyed JSON in → keyed SSR HTML out). The client-side in-place enhancer is slice B (#1904); end-to-end build wiring is slice C (#1905). The #1600 table→data-table family ([#1609](/backlog/1609-migrate-table-surfaces-in-we-src-includes-project-to-fui-dat/)–[#1613](/backlog/1613-migrate-table-surfaces-in-we-src-includes-research-descripti/)) re-points to #1905. The non-deterministic app case is #1827.
