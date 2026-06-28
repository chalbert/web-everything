---
kind: story
size: 3
parent: "912"
status: resolved
blockedBy: ["1759"]
dateOpened: "2026-06-24"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: 912
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, workbench, polyglot, functional-adapter, maas]
---

# Functional MaaS serve route — serve the live functional module cross-origin, keyed off caseId (sibling to wrapperServeHandler, not a wrapper-catalog member #1619)

Serve the #1759 live functional module over the existing cross-origin MaaS second origin (stood up by #1501, inheriting the #1556 CORS fix). A sibling route to fui:tools/maas/wrapperServeHandler.mjs, but keyed off caseId against we:src/_data/authorModeSource.json cases (NOT a wrapper-catalog ?form= member — #1619 keeps the functional id-space separate). Mirrors the wrapper endpoint #1029: content-identity + cache + error contract, with produceFunctionalBytes-live injected as the producer. Gives the workbench mount (#1746 chain) a cross-origin URL to import so the framework-free workbench (#955-B) never pre-bundles react into the main origin.

## Progress (batch-2026-06-26-1745-1775)

Built the functional-serve route as a sibling of `fui:tools/maas/wrapperServeHandler.mjs`, keyed off `caseId` in a
separate id-space under `/_maas/fn/` (#1619 — not a wrapper `?form=` member), injecting the #1759
`produceFunctionalBytes` producer:
- `fui:tools/maas/functionalServeHandler.mjs` — `createFunctionalServeHandler`: full MaaS HTTP/identity
  contract (content-addressed id + integrity, floating→pin 302 ladder, ETag/If-None-Match→304, immutable/
  floating cache, CORS on every response + OPTIONS preflight, 400 bad-variant / 404 unknown-case / drifted-
  pin error set). `variant=functional` (render-only) | `variant=live` (self-contained mount). Source +
  producer are injection seams (unit-testable with no file/server).
- `fui:tools/maas/vite-plugin.mjs` — wired the `/_maas/fn/` middleware before the generic `/_maas/`
  wrapper route (more-specific prefix first), sharing the Fetch↔Node-stream adapter.
- `fui:tools/maas/__tests__/functionalServeHandler.test.mjs` — 10 tests, all green, over an injected
  fixture source (mirrors the #1759 producer test posture).

**Live-serving note:** the route reads `we:src/_data/authorModeSource.json` via the injectable `readSource` (default
`readAuthorModeSource`). That artifact's transport wiring is **#1618 (open)** and the file isn't present
yet, so real requests 404 per-case until #1618 lands — the route goes live automatically when it does.
This matches the #1759 producer's deliberately file-independent design; #1618 is the downstream
integration, not a blocker on this route's deliverable.

FUI `check:standards` baseline-steady (34 pre-existing errors, none in this changeset).
