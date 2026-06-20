---
kind: story
size: 3
parent: "972"
locus: frontierui
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "fui:demos/behavior-coordinators-demo.html"
tags: []
---

# Author + host FUI demos for the behavior-coordinator blocks (master-detail, resource-loader, data-transfer)

Author runtime demos for master-detail, resource-loader and data-transfer in fui:demos/ and wire demoFile. Slice of #972; locus frontierui.

## Progress — done in batch-2026-06-18

Authored `fui:demos/behavior-coordinators-demo.html` (reuses `fui:demos/playground.css`), three live sections:
- **master-detail** — `new MasterDetailBehavior(masterList, { detailEl, itemSelector, keyOf, renderDetail })`;
  selecting a master row renders that person's detail into the labelled region.
- **resource-loader** — `new ResourceLoader({ target }).load(async (signal) => …)`; a button drives the
  pending→loading→success state machine and renders the loaded data.
- **data-transfer** — registers `<data-transfer-zone>`; a file chooser fires one normalized `receive` event,
  displayed from `payload.items` (`kind` + name/text).

Wired `demoFile` on all three blocks + cleared them from `DEMO_PENDING` (`fui:scripts/check-standards.mjs`,
#973). **Playwright-verified on :3001**: master-detail renders Turing's detail, loader reaches "Loaded 3
items", file input → "received: file notes.txt", 0 console errors. FUI check:standards green.
