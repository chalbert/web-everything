---
kind: task
parent: "1294"
status: resolved
blockedBy: ["2295"]
dateOpened: "2026-07-06"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: demos/webprocess-conformance-demo.ts, plateau-app/src/conformance-engine/embedSuites.ts
tags: []
---

# Wire the webprocess docs conformance page via the plateau iframe

Repoint we:demos/webprocess-conformance-demo.ts off its build-time we:process/index.ts import onto the plateau-hosted conformance iframe (over the FUI binding + WE vectors), mirroring the webpolicy/webcompliance docs pages. Fourth slice of the process cascade under #1294; must land before the WE runtime delete.

## Resolution (2026-07-09)

A clean mirror of the webpolicy wiring (#1801) and the analytics/intl/reliability wirings that followed it —
the `EMBED_SUITES` registry (#1801) made this a one-line registration:

- **Plateau**: registered the `webprocess` suite in the conformance iframe — an `EMBED_SUITES` entry in
  `plateau:src/conformance-engine/embedSuites.ts` pairing the WE `webprocessSuite`
  (`@webeverything/conformance-vectors/webprocess`) with FUI's relocated binding (`@frontierui/webprocess` →
  `WebprocessConformanceBindingFactory`, #2295). Added the `@frontierui/webprocess` runtime alias and the
  `@webeverything/conformance-vectors/webprocess` vector alias to `plateau:tsconfig.json` +
  `plateau:vite.config.mts` (plus the type-only `@webeverything/contracts/webprocess` tsconfig path,
  erased at runtime).
- **WE**: repointed `we:demos/webprocess-conformance-demo.ts` — removed the `we:process/index.ts` runtime
  import + in-page `CHECKS` asserts (WE zero-executable, #1282); it now embeds the plateau `conformance`
  iframe cross-origin (`?suite=webprocess`), validates the plateau origin, and reflects the posted result
  via `setPlaygroundReady`. Rewrote `we:demos/webprocess-conformance-demo.html` intro, swapped its
  stylesheet to the shared `we:demos/conformance-demo.css` (iframe style), deleted the now-dead
  `we:demos/webprocess-conformance-demo.css`, and updated the demo catalog
  `we:src/_data/demos/webprocess-conformance-demo.json`.
- **Verified**: plateau `vitest run` (with sibling WE/FUI checkouts resolvable) shows all 11 webprocess
  vectors registered and green through the real binding; plateau's full unit suite (748/748) and WE's full
  unit suite (2616/2616) both pass; WE `check:standards` 0 errors.
- **Next**: the WE runtime delete (#2297) is now unblocked — `we:process/{driver,registry,provider,index}.ts`
  are orphaned (contract + vectors stay).
