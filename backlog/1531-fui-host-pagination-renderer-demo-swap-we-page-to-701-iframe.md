---
kind: story
size: 5
parent: "1353"
status: open
blockedBy: ["1356"]
dateOpened: "2026-06-22"
tags: []
---

# FUI-host pagination renderer demo, swap WE page to #701 iframe, delete we:blocks/renderers/pagination backend

Swap we:demos/pagination-demo.html to a #701 fuiDemo iframe over fui:demos/pagination-demo.html; live-verify the FUI demo renders on the FUI dev server first; then delete the WE runnable backend we:blocks/renderers/pagination (renderPagination + compute; keep PageState type per #1467) + we:demos/pagination-demo.{ts,css}. blockedBy #1356 (golden-vector verifier redesign) — deleting renderPagination strands the WE conformance tests until #1356 drops their value-import. Sibling of #1355 (data-table delete). Carved from #1356 per we:reports/2026-06-22-backlog-split-analysis.md (Run 5).
