---
kind: epic
status: open
dateOpened: "2026-06-21"
locus: plateau-app
blockedBy: ["1654", "1655", "1656"]
relatedReport: reports/2026-06-22-1391-split-analysis.md
tags: [dev-browser, dev-experience, plateau, product]
---

# Dev-browser shell build — Chromium shell embedding plateau-app panels (#141 successor)

The build of the **dev-browser shell itself** — the rightmost column of the [#140](/backlog/140-dev-surface-product-feature-matrix/) surface matrix and the staged successor [#141](/backlog/141-dev-browser-vision/) ratified ("extension/panel first, browser shell later") but never filed. A Chromium shell whose introspection tooling lights up only on WE-conformant apps, embedding plateau-app's panels (`plateau:src/technical-configurator/`, `intent-configurator/`, `profiles/`) per #141 Fork 4-A, reusing the built IDE-bridge substrate (#575/#576/#577/#676). Homed in `plateau:src/dev-browser/`. Filed so the shell is a tracked dependency edge, not an unfiled gap — **not funded to build yet**, gated behind the funnel-data triage in [#1590](/backlog/1590-dev-surface-monetization-bet-extensions-as-funnel-vs-dev-bro/) (the surface bet carved out of the #140 matrix); the home downstream surfaces (e.g. [#1083](/backlog/1083-dev-browser-opt-in-surface-for-the-tier-2-vision-tier/)) depend on.

## Scope (to slice when funded)

- Chrome-level capabilities an extension can't reach: navigation interception, a "not WE-compatible" screen, conformance-gated feature lighting.
- Panel embed seam (#141 Fork 4-A) — package vs iframe/web-component boundary to plateau-app's panels (the deferred build detail).
- Free-tier + caveats → paid licensing surface (#141 commercial-license fork).

## Sequencing

Per the [monetization](docs/agent/platform-decisions.md#monetization) rule (#141), the **extension / DevTools-panel MVP is the first fundable build** (cheap funnel, proves "lights up on a conformant app"); this shell is the later monetizable product. File the extension-MVP separately as the leading build; advance this epic only once that proves the model OR a capability demands chrome-level UI an extension can't reach.
