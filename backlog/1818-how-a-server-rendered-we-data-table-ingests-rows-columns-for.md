---
kind: decision
status: open
size: 2
locus: frontierui
dateOpened: "2026-06-27"
tags: [data-table, transient-ce, embed-boundary, ssr, webdocs]
---

# How a server-rendered we-data-table ingests rows/columns for the docs transient-CE dogfood (JS-property contract is function-valued)

Surfaced building #1787 (data-table embed entry). The transient-CE/SSR docs pattern (badge #1758, code-view #1785) hydrates an element from its **light DOM** with no per-element JS. But `<we-data-table>` (`fui:blocks/renderers/data-table` `DataTableModule`) ingests **only via JS properties** `.rows` / `.config` — by design: "config carries call-site predicates/comparators, so it is a JS property, not an attribute." The renderer contract is **function-valued** (`Column.format: (value,row)=>string|Node`, `Intl.Collator` comparators, filter predicates), so it serializes to neither SSR `<table>` DOM nor a JSON attribute. A statically server-rendered docs table therefore cannot drive the current element. Decide the docs ingestion path before #1787 builds.

## What you decide
How a server-rendered `<we-data-table>` (no per-element JS) acquires its rows/columns for the docs surface — and what declarative subset of the function-valued renderer contract the docs path exposes.

## Options
- **(A) — bold default — declarative JSON payload + SSR `<table>` baseline.** The element reads an authoritative `<script type="application/json">` child (rows + plain column defs: `field`/`label`/`sortable`) on upgrade and renders; the server also emits a real `<table>` as the no-FOUC/no-JS baseline (progressive enhancement for the shell, JSON for the data). Function-valued options (`format`/comparators) are simply **absent** in the declarative docs subset — fine for static docs tables, available only on the programmatic `.config` path. Clean, lossless for the data it does carry, no DOM-reparse.
- **(B) parse the SSR `<table>` light DOM.** Element reads `thead`→columns, `tbody`→rows (strings) and builds a config. Zero payload, but **lossy** (everything stringifies; no types, no `sortable`, no `format`) — and re-deriving structured data from presentation DOM inverts the renderer's own data→DOM direction.
- **(C) `data-*` attribute JSON.** Like (A) but the payload rides an attribute instead of a child script — worse for large tables (attribute size, escaping) with no benefit over a typed `<script>` child.

## Lineage
Blocks #1787 (its `blockedBy`), which is the foundational prerequisite for the #1600 table→data-table family (#1609–#1613).
