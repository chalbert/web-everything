---
kind: story
size: 3
parent: "1600"
status: open
dateOpened: "2026-06-26"
locus: frontierui
relatedProject: webdocs
tags: [webdocs, data-table, transient-ce, embed-boundary]
---

# FUI data-table transient-CE embed entry (we-data-table) + SSR baseline

The foundational prerequisite unblocking the #1600 table-to-data-table family (#1609/#1610/#1611/#1612/#1613) — the data-table counterpart to the badge `#1758` embed entry and the code-view `#1785`. Ship `fui:embed/data-table-in-document.ts`: a runtime cross-origin-importable entry registering a transient `<we-data-table>` over `fui:blocks/renderers/data-table` and injecting its CSS once into the host document. The data-table is a RENDERER (consumes row/column data, not just text), so its contract differs from text-only `we-badge`/`we-code-view` — decide how the SSR `<table>` markup is read into the renderer (progressive-enhancement vs a data attribute) and the SSR/FOUC baseline. Wire the import into `we:src/_layouts/base.njk`; then the five table children unblock.
