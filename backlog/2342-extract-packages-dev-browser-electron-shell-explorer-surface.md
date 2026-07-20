---
kind: story
size: 8
parent: "2346"
status: resolved
blockedBy: ["2340", "2341"]
dateOpened: "2026-07-09"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: "plateau-app:packages/dev-browser/"
tags: []
---

# Extract packages/dev-browser — Electron shell + explorer surface as a workspace package

Move the dev-browser production (plateau:src/dev-browser/* — shell, capture, element-resolver, fault-injector, headed-surface, ide-bridge, intent-inspector, variant-simulator, forge, etc.) into plateau:packages/dev-browser as @plateau/dev-browser, depending on @plateau/core for the conformance probe. Critically, Electron is added as a dependency of THIS package only, not the plateau-app root — which dissolves the ~100MB-native-add objection in #1753's humanGate. The chrome-extension piece is split out to packages/extensions separately. First extraction to prove the incremental-migration pattern end to end.
