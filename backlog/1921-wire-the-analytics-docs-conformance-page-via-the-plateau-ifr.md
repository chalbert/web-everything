---
kind: story
size: 2
parent: "1294"
status: resolved
dateOpened: "2026-06-28"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
tags: []
---

# Wire the analytics docs conformance page via the plateau iframe

Slice 3 of the analytics relocation cascade (#1294). Wire the visible analytics conformance docs page to surface the FUI binding via the plateau-hosted conformance iframe (#1788 ratified (b) — runner stays a shared plateau tool), no forbidden build-time @frontierui import. Mirrors webpolicy W3 (#1801).

## Progress

- **Status:** resolved
- **Branch:** main
- **Done (a clean mirror of the intl wiring #1920):**
  - Plateau: registered the `analytics` suite in the conformance iframe — an `EMBED_SUITES` entry in `plateau:src/conformance-engine/embedSuites.ts` pairing the WE `analyticsSuite` (`@webeverything/conformance-vectors/analytics`) with FUI's relocated binding (`@frontierui/plugs/webanalytics` → `AnalyticsConformanceBindingFactory`, #1918). The FUI binding resolves via the existing `@frontierui/plugs/*` alias; added the one WE-vector dev-time alias (`@webeverything/conformance-vectors/analytics`) to `plateau:tsconfig.json` + `plateau:vite.config.mts`. The suite runs the #1847 predicate matchers over the recorded-call log (routing / swap-reroute / arg-order / absence / count, #1816).
  - WE: repointed `we:demos/analytics-conformance-demo.ts` — removed the in-demo recording-stub backends + in-page `data-track`/registry asserts (WE zero-executable, #1282); it now embeds the plateau `conformance` iframe cross-origin (`?suite=analytics`), validates the plateau origin, and reflects the posted result via `setPlaygroundReady`. Rewrote `we:demos/analytics-conformance-demo.html` intro + swapped its stylesheet to the shared `we:demos/conformance-demo.css` (iframe style), deleted the now-dead `we:demos/analytics-conformance-demo.css`, and updated the demo catalog `we:src/_data/demos/analytics-conformance-demo.json`.
- **Gates:** plateau `vite build` green (the built conformance bundle includes the analytics binding); WE `check:standards` — no new errors from this changeset (the 3 repo errors are pre-existing wiki-link violations in unrelated items #907/#2155/#2156).
