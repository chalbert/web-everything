---
type: issue
workItem: story
size: 3
parent: "823"
status: resolved
blockedBy: ["833", "834"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: frontierui/demos/loan-origination.html
locus: frontierui
tags: []
---

# Host the loan-origination exercise app in FUI

Move demos/loan-origination/ → frontierui/demos/ and register it in FUI's demos public surface. Block-impl + renderer deps resolve after #833 (+#694); FUI's bootstrap registers the router shell; import paths survive unchanged — EXCEPT loan's CustomGuardRegistry (loan we:app.ts:29,99-100), a WE standard model with no FUI home. Resolve that per #834 (bring the guard model up vs decouple) before this lands. Register, verify it boots in a browser. Slice of #823 (#812 Fork-1(a)).

## Progress (2026-06-17) — built (locus frontierui)

- **Guard brought up (per #834 ruling A):** byte-copied the guard closed-set `guard/{provider,registry,accessControl,index}.ts` + `__tests__/` → [`frontierui/blocks/guard/`](../../frontierui/blocks/guard/) (`diff -q` clean, all 6 files identical); added `./guard` + `./guard/*` entries to [`fui:frontierui/blocks/package.json`](../../frontierui/blocks/package.json). WE's copy untouched (drift-source until #658). Guard tests pass in the new home (24/24 via `vitest run blocks/guard`).
- **App hosted in FUI:** copied the payload into [`frontierui/demos/loan-origination/`](../../frontierui/demos/loan-origination/) (`we:app.ts`, `we:app.css`, `domain/*`, `configurator/*`, `wizard/*`, `providers/*`, `we:conformance.json`, `we:CHECKLIST.md`) + a flat entry [`fui:frontierui/demos/loan-origination.html`](../../frontierui/demos/loan-origination.html) at the demos root (FUI's flat-scan convention, mirroring #835's auto-insurance).
- **Import rewires (the only delta vs auto-insurance):** the 2 WE-only guard imports repointed at the FUI copy — `we:app.ts:29` (`CustomGuardRegistry`) and `we:domain/permissions.ts:30-31` (`CustomGuardProvider`/`ALLOW`) now resolve `../../blocks/guard/…`. All `../../blocks/…` renderer/family imports survive unchanged (FUI hosts `blocks/`; renderer-impls up via #833).
- **Registration:** FUI's flat demos scanner ([`fui:src/_data/demos.js`](../../frontierui/src/_data/demos.js)) lists it automatically (`{slug:"loan-origination", href:"fui:/demos/loan-origination.html"}`); html asset refs are absolute so its location is payload-independent. Additive only — WE's copy + refs stay until the downstream WE-embed/delete slices (#837 → #824).
- **Catalog:** registered guard in [`fui:frontierui/src/_data/blocks.json`](../../frontierui/src/_data/blocks.json) (completeness gate #784). guard is the first **protocol-backed** FUI block — its WE-canonical spec is the `/protocols/guard/` page, not a `/blocks/{id}/` page — so generalized `we:scripts/check-standards.mjs` weSpecPath validation + cross-repo resolution to accept `/protocols/{id}/` (resolved against WE `we:protocols.json`).
- **Verified:** Playwright boot on `:we:3001/demos/loan-origination.html` → title correct, `#app` renders the real "MERIDIAN Loan Origination System" UI (45 descendant els, not "Loading…"), **zero** console/page errors; FUI `check:standards` → 0 errors from this slice's files (the lone error is `blocks/button/`, a concurrent session's untracked in-flight family, not mine).
