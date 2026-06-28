---
kind: story
size: 5
parent: "1391"
status: open
locus: plateau-app
blockedBy: ["1753"]
dateOpened: "2026-06-24"
tags: []
---

# Dev-browser shell — conformance-gated feature lighting (capability-manifest gate)

Read the per-feature capability manifest from the loaded app and light up each existing plateau:src/dev-browser/* capability module (capture, ide-bridge, fault-injector, intent-inspector, variant-simulator, …) against the capability it needs — partial conformance first-class (#141 Fork 1A, ratified per-feature degrade). Home plateau:src/dev-browser/shell/. Demoable: a thinly-conformant app lights exactly its supported slice.
