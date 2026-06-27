---
kind: story
size: 3
parent: "1600"
status: open
blockedBy: ["1818"]
dateOpened: "2026-06-26"
dateStarted: "2026-06-27"
locus: frontierui
relatedProject: webdocs
tags: [webdocs, data-table, transient-ce, embed-boundary]
---

# FUI data-table transient-CE embed entry (we-data-table) + SSR baseline

> **Pre-flight (batch-2026-06-26-1793-1697) — the embedded "decide how the SSR markup is read" is a real fork → filed #1818, `blockedBy` it.** The badge/code-view precedent does **not** transfer: `<we-data-table>` (`fui:blocks/renderers/data-table` `DataTableModule`) ingests **only via JS properties** `.rows`/`.config` (config is function-valued — `Column.format`, `Intl.Collator` comparators, filter predicates — "a JS property, not an attribute"), so a statically server-rendered docs table (no per-element JS) can't drive it, and the contract serializes to neither SSR `<table>` DOM nor a JSON attribute. The docs ingestion path (declarative JSON payload vs PE-parse the `<table>`) and the declarative subset of the renderer contract must be ruled first — **#1818**. The mechanical embed-entry wiring (register + inject CSS once + import in `we:src/_layouts/base.njk`) is then trivial like code-view. Released unbuilt.

The foundational prerequisite unblocking the #1600 table-to-data-table family (#1609/#1610/#1611/#1612/#1613) — the data-table counterpart to the badge `#1758` embed entry and the code-view `#1785`. Ship `fui:embed/data-table-in-document.ts`: a runtime cross-origin-importable entry registering a transient `<we-data-table>` over `fui:blocks/renderers/data-table` and injecting its CSS once into the host document. The data-table is a RENDERER (consumes row/column data, not just text), so its contract differs from text-only `we-badge`/`we-code-view` — decide how the SSR `<table>` markup is read into the renderer (progressive-enhancement vs a data attribute) and the SSR/FOUC baseline. Wire the import into `we:src/_layouts/base.njk`; then the five table children unblock.
