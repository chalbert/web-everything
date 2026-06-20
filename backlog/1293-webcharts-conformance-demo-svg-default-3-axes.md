---
kind: story
size: 3
parent: "1004"
status: resolved
blockedBy: ["1292"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:demos/webcharts-conformance-demo.ts"
tags: []
---

# Webcharts conformance demo (SVG default, 3 axes)

Webcharts conformance demo: 3-file playground (JSON + HTML + TS, setPlaygroundReady) running the four we:src/cases/webcharts/*.html against the SVG default, scoring semantic-fidelity / theme-application / a11y. Mirrors we:demos/analytics-conformance-demo.ts + the webpositioning conformance demo anatomy.

## Progress (batch-2026-06-20b)

- Built the playground mirroring the webpositioning conformance demo anatomy: `we:demos/webcharts-conformance-demo.ts`
  + `.html` + `.css` + the registry spec `we:src/_data/demos/webcharts-conformance-demo.json`.
- Per the docs-rendering boundary (WE never imports `fui:charts`), the demo supplies its **own in-demo SVG
  `CustomChartRenderer`** — importing only the type-only contract `we:charts/contract.ts` (#1334) — exactly
  like the webpositioning demo's in-demo strategy. It proves the contract is *realizable*; the real FUI
  renderer's conformance is covered by `fui:charts/__tests__` (#1292).
- Renders a live gallery (the four-case specs, each with its derived data-table) and scores the **3 axes**
  against the `we:src/cases/webcharts/*` specs: semantic-fidelity (one mark/row, in order, proportional),
  theme-application (palette-order fills + re-theme), accessibility (figure/table fallback + WAI-ARIA
  Graphics roles). `setPlaygroundReady(pass)` exposes the count for the e2e smoke.
- Browser-verified live on :3000 — `playgroundReady=true`, **5/5 checks pass, 0 fails**, 3 charts + 3
  fallback tables rendered, no functional console errors. WE gate green (`check:standards --scope`, 0
  errors; `we:AGENTS.md` inventory regenerated).
