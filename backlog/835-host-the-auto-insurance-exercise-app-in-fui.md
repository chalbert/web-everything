---
kind: story
size: 3
parent: "823"
status: resolved
blockedBy: ["833"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: frontierui/demos/auto-insurance.html
locus: frontierui
tags: []
---

# Host the auto-insurance exercise app in FUI

Move demos/auto-insurance/ → frontierui/demos/ and register it in FUI's demos public surface (auto-scans demos/*.html). All deps resolve after #833: block-impl families (audit, lifecycle, master-detail, selection, stepper, tree-select) already up via #694; renderer-impls via #833; FUI's we:plugs/bootstrap.ts:204 registers the same router shell the app boots on; import paths (../../blocks/…, we:/plugs/bootstrap.ts) survive the move unchanged. auto-insurance has ZERO WE-only standard dep (its only guard token is the GuardResolver type from lifecycle). Verify it boots in a browser. Slice of #823 (#812 Fork-1(a)).

## Progress (2026-06-17, batch-2026-06-17) — built (locus frontierui)

- **Hosted in FUI:** copied the app into `frontierui/demos/` — payload subdir `demos/auto-insurance/` (`we:app.ts`, `we:app.css`, `domain/*` ×11, `we:conformance.json`, `we:CHECKLIST.md`) + a flat entry `fui:demos/auto-insurance.html` at the demos root.
- **Registration mechanism:** FUI's demos gallery scanner ([`fui:src/_data/demos.js`](../../frontierui/src/_data/demos.js)) is **flat** (`readdirSync` of `demos/*.html`, non-recursive — matching the established FUI convention: declarative-spa, data-grid-demo are flat-entry; the only subdir, `durable-tier-verification`, is a #708 verification harness deliberately unlisted). So the entry is the flat `fui:auto-insurance.html` (scanned automatically) with the payload in the subdir; the html's asset refs are all **absolute** (`/demos/auto-insurance/app.{ts,css}`, `we:/plugs/bootstrap.ts`) so its location is independent of the payload. No scanner change → durable-tier stays unlisted. **Additive only** — WE's copy + we:demos.json/blocks.json refs stay until the downstream WE-embed/delete slices (#837 → #824).
- **Verified:** scanner lists it (`{slug:"auto-insurance", href:"fui:/demos/auto-insurance.html"}`); FUI dev server `:3001` serves it (200); Playwright boot on `:we:3001/demos/auto-insurance.html` → title correct, `#app` rendered (35 descendant els: "Beacon Auto Insurance" UI, not "Loading…"), **zero** console/page errors; `npm run check:standards` in `../frontierui` → 0 errors, 0 warnings. (Minor: `/favicon.svg` 404s on FUI — cosmetic, not app-blocking.)
