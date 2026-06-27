---
kind: story
size: 2
parent: "1294"
status: resolved
blockedBy: ["1800"]
dateOpened: "2026-06-26"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: plateau-app/conformance.html
tags: []
---

# Wire the webpolicy docs conformance page via the plateau iframe

Repoint we:demos/webpolicy-conformance-demo.ts to render webpolicy conformance pass/fail through the plateau-hosted conformance iframe (#1790/#1788 (b)) running the webpolicy vector suite against the FUI binding — replacing the bespoke in-page asserts. The visible plateau-origin docs surface for webpolicy. Blocked on the binding + vectors (W2).

## Progress

- **Status:** resolved
- **Branch:** main
- **Done:**
  - Plateau: built the plateau-origin conformance iframe surface #1790/#1788 picked but folded into #1294 — `plateau:conformance.html` (thin standalone page) + `plateau:src/conformance-engine/conformanceEmbed.ts` (reads the `?suite=` query, runs `ConformanceVectorOracle`, renders pass/fail, postMessages a compact result) + `plateau:src/conformance-engine/embedSuites.ts` (generic `EMBED_SUITES` registry pairing a WE suite with its FUI binding factory). Registered `plateau:conformance.html` as a `plateau:vite.config.mts` build input.
  - WE: repointed `we:demos/webpolicy-conformance-demo.ts` — removed the WE-runtime imports + in-page asserts (WE zero-executable, #1282); it now embeds the plateau iframe cross-origin (the plateau `conformance` surface with `?suite=webpolicy`), validates the plateau origin, and reflects the posted result via `setPlaygroundReady`. Updated `we:demos/webpolicy-conformance-demo.html` intro + `we:demos/conformance-demo.css` (iframe style) + the demo catalog JSON.
- **Verified (live, against the running servers):** plateau iframe at :4000 renders 7/7 webpolicy vectors green + posts the result; the WE demo at :3000 embeds it and reflects "7/7 … passed" with `window.playgroundReady=true, playgroundPass=7`, no console errors. Plateau tsc clean · WE check:standards 0 errors · 11ty build clean (4209 files).
- **Next:** done. W4 (#1802) deletes the now-orphaned WE webpolicy runtime + tests (contract + vectors stay) — now ready. The `EMBED_SUITES` registry is generic, so future relocated runtimes get a visible conformance page with a one-line registry entry.
- **Notes:** The visible page is the cross-origin runtime boundary #1788 (b) ratified — reaches the plateau-homed shared runner with no FUI↛plateau edge and no mode-C #765 trust-surface change.
