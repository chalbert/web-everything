---
kind: story
size: 5
parent: "1353"
status: open
blockedBy: ["1382"]
dateOpened: "2026-06-20"
tags: []
---

# FUI-host data-table renderer demo, swap WE page to #701 iframe, delete we:blocks/renderers/data-table

Build fui:demos/data-table-demo.html self-bootstrapping the (complete) FUI data-table renderer; swap we:demos/data-table-demo.html to a #701 fuiDemo iframe; delete we:blocks/renderers/data-table + we:demos/data-table-demo.{ts,css}. #1326 pattern.

## Pre-flight note — unmet build precondition; re-sized 3 → 5 (batch-2026-06-20-1344-1342)

Skipped in-batch: this is **not** the clean size-3 delete+swap the #1326 precedent was. #1326 (size 3) only
deleted+swapped because its self-bootstrapping `fui:demos/view-tabs-demo.html` **already existed** — it was
built first as the *separate* landed item #1312. Here `fui:demos/data-table-demo.html` does **not** exist
yet (no data-table demo under `fui:demos/`), so this card bundles building a self-bootstrapping FUI
demo that faithfully reproduces the 216-line `we:demos/data-table-demo.ts` + browser-verifying it renders,
**then** the swap + delete. Recommend splitting the demo build (the #1312-analog) into its own prereq and
making this card the delete+swap `blockedBy` it; both need a focused session with the FUI dev server for
live render verification before the WE source is deleted.
