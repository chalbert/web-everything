---
kind: story
size: 2
parent: "1294"
status: resolved
blockedBy: ["1919", "1947"]
dateOpened: "2026-06-28"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: plateau-app/conformance.html
tags: []
---

# Wire the reliability docs conformance page via the plateau iframe

Slice 3 of the reliability relocation cascade (#1294). Wire the visible reliability conformance docs page to surface the FUI binding via the plateau-hosted conformance iframe (#1788 ratified (b) — runner stays a shared plateau tool), no forbidden build-time @frontierui import. Mirrors webpolicy W3 (#1801).

## Progress

- **Status:** resolved
- **Branch:** main
- **Done:**
  - Plateau: registered `reliability` in the plateau-hosted conformance embed registry — `plateau:src/conformance-engine/embedSuites.ts` (`EMBED_SUITES.reliability = { suite: reliabilitySuite, factory: new ReliabilityConformanceBindingFactory() }`, pairing the WE reliability vector suite #1919 with FUI's relocated binding). Added the resolution paths in `plateau:tsconfig.json` (`@webeverything/conformance-vectors/reliability`, `@frontierui/reliability`, and the type-only `@webeverything/contracts/reliability` the FUI runtime pulls in transitively) and `plateau:vite.config.mts` (the two runtime aliases). The `?suite=reliability` iframe now renders through the neutral runner. `npm run build` green (`plateau:conformance.html` built), tsc clean over the changeset.
  - WE: repointed `we:demos/webreliability-conformance-demo.ts` — removed the WE reliability-contract import + the six in-page contract asserts (the demo's own `DemoRecoveryHandler`; WE holds zero executable, #1282). It now embeds the plateau conformance iframe cross-origin (`?suite=reliability`), validates the plateau origin, and reflects the posted result via `setPlaygroundReady`. Rewrote `we:demos/webreliability-conformance-demo.html` intro/caveat (relocation → FUI, plateau runner boundary) + switched it to the shared `we:demos/conformance-demo.css`, deleting the now-orphaned bespoke `we:demos/webreliability-conformance-demo.css`. Updated the demo catalog JSON (`we:src/_data/demos/webreliability-conformance-demo.json`).
- **Verified:** WE `npm run check:standards` 0 errors; plateau `npm run build` green with the reliability suite in `plateau:conformance.html`.
- **Next:** done. The `EMBED_SUITES` registry stays generic; another relocated runtime is a one-line entry + its WE suite + FUI binding.
- **Notes:** The visible page is the cross-origin runtime boundary #1788 (b) ratified — reaches the plateau-homed shared runner with no FUI↛plateau edge and no mode-C #765 trust-surface change. Mirrors webpolicy W3 (#1801) exactly.
