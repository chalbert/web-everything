---
kind: epic
status: open
blockedBy: ["2342"]
dateOpened: "2026-06-21"
locus: plateau-app
relatedReport: reports/2026-06-24-backlog-split-analysis.md
tags: [dev-browser, dev-experience, plateau, product]
---

# Dev-browser shell build — stock-Chromium desktop shell embedding plateau-app panels (#141 successor)

Umbrella for the **dev-browser shell itself** — the rightmost column of the [#140](/backlog/140-dev-surface-product-feature-matrix/) surface matrix and the staged successor [#141](/backlog/141-dev-browser-vision/) (Fork 2: extension/panel first → **standalone dev browser on stock Chromium + CDP/extension APIs**; a Chromium *fork* stays a deferred last resort). A stock-Chromium desktop shell (Electron/CEF-class — bundled, unforked Chromium with custom chrome) whose introspection tooling lights up only on WE-conformant apps, embedding plateau-app's panels (`plateau:src/technical-configurator/`, `intent-configurator/`, `profiles/`) and reusing the built IDE-bridge substrate (#575/#576/#577/#676). Homed in `plateau:src/dev-browser/shell/`. Downstream surfaces (e.g. [#1083](/backlog/1083-dev-browser-opt-in-surface-for-the-tier-2-vision-tier/)) depend on this.

Its build gate is now lifted: [#1590](/backlog/1590-dev-surface-monetization-bet-extensions-as-funnel-vs-dev-bro/) decoupled build from release ("pursue the full product now"), the leading funnel-MVP build [#1656](/backlog/1656-conformance-lit-extension-funnel-mvp-chrome-devtools-panel-t/) resolved, and the two build-shape forks resolved ([#1654](/backlog/1654-dev-browser-panel-embed-boundary-package-import-vs-iframe-we/) panel embed = direct `mount*(el)` import; [#1655](/backlog/1655-dev-browser-in-shell-free-paid-line-which-shell-capabilities/) free/paid = two-gate license + server-tier). Sliced 2026-06-24 ([report](reports/2026-06-24-backlog-split-analysis.md)) into the foundational shell scaffold + four independent capabilities behind it.

## Slices

- **S1 (foundational)** — stock-Chromium shell scaffold + WE-conformance probe on load (reuses `window.__WE_DEVTOOLS_GLOBAL_HOOK__` / `script[type="registry"]`, #1673/#1722).
- **S2** — navigation interception + the "not WE-compatible" full-screen takeover. *(blockedBy S1)*
- **S3** — conformance-gated feature lighting (capability-manifest gate, #141 Fork 1A). *(blockedBy S1)*
- **S4** — panel embed via direct `mount*(el)` import (#1654). *(blockedBy S1)*
- **S5** — license-gating wiring: commercial-use license + server-cost-tier check (#1655). *(blockedBy S1)*

S1 lands first; S2–S5 then proceed independently, each leaving a valid demoable shell state. *Build-detail residual:* the S1 packaging vehicle (Electron vs CEF) is a defaulted detail (Electron), not a held-open fork — the CDP-over-stock-Chrome branch is flawed (can't deliver the takeover screen / out-of-dock UI).
