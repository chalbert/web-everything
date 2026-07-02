---
kind: story
size: 2
parent: "1294"
status: resolved
blockedBy: ["1917", "1947"]
dateOpened: "2026-06-28"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
tags: []
---

# Wire the intl docs conformance page via the plateau iframe

Slice 3 of the intl relocation cascade (#1294). Wire the visible intl conformance docs page to surface the FUI binding via the plateau-hosted conformance iframe (#1788 ratified (b) — runner stays a shared plateau tool), no forbidden build-time @frontierui import. Mirrors webpolicy W3 (#1801).

## Progress

- **Status:** resolved
- **Branch:** main
- **Done:**
  - Plateau: registered the `intl` suite in the conformance iframe — a one-line `EMBED_SUITES` entry in `plateau:src/conformance-engine/embedSuites.ts` pairing the WE `intlSuite` (`@webeverything/conformance-vectors/intl`) with FUI's relocated binding (`@frontierui/intl` → `IntlConformanceBindingFactory`, #1917/#1914). Added the two dev-time aliases (`@frontierui/intl`, `@webeverything/conformance-vectors/intl`) to `plateau:tsconfig.json` + `plateau:vite.config.mts`.
  - WE: repointed `we:demos/webintl-conformance-demo.ts` — removed the in-demo `Intl.*` provider + in-page asserts (WE zero-executable, #1282); it now embeds the plateau `conformance` iframe cross-origin (`?suite=intl`), validates the plateau origin, and reflects the posted result via `setPlaygroundReady`. Rewrote `we:demos/webintl-conformance-demo.html` intro + swapped its stylesheet to the shared `we:demos/conformance-demo.css` (iframe style), deleted the now-dead `we:demos/webintl-conformance-demo.css`, and updated the demo catalog `we:src/_data/demos/webintl-conformance-demo.json`.
- **Gates:** plateau `vite build` green (built conformance bundle includes the intl binding); WE `check:standards` — no new errors from this changeset (the 3 repo errors are pre-existing wiki-link violations in unrelated items #907/#2155/#2156).
