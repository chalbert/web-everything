---
kind: epic
status: resolved
dateOpened: "2026-07-09"
dateResolved: "2026-07-10"
graduatedTo: none
tags: []
---

# plateau-app monorepo — split the identified productions into npm workspace packages

Reorganize plateau:plateau-app from a flat src/ app into an npm-workspaces monorepo, one package per identified production: packages/core (shared conformance-engine + registry probe markers), packages/dev-browser (Electron shell + explorer surface), packages/saas (control-plane, marketing, web-docs, profiles), packages/extensions (chrome-extension pulled up), packages/tooling (judge/eval, configurators, compatibility-map). Tool is npm workspaces — root is already npm + private, so add workspaces:[packages/*] with no new toolchain. Migration is incremental (stand up the skeleton, move one production at a time behind path aliases), dev-browser first. Key payoff: Electron becomes a dep of packages/dev-browser only, not the plateau-app root — which dissolves the ~100MB-native-add objection blocking the dev-browser shell.
