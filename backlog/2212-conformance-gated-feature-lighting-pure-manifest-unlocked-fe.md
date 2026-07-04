---
kind: story
size: 3
parent: "1755"
locus: plateau-app
status: resolved
dateOpened: "2026-07-03"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
graduatedTo: none
tags: []
---

# Conformance-gated feature-lighting — pure manifest→unlocked-features function (headless)

Pure function lightFeatures(manifest) -> unlockedFeatureIds[] gating each plateau:src/dev-browser/* capability module against the CapabilityManifest (we:capability-manifest/provider.ts) it needs; partial conformance first-class (#141 Fork 1A). Fully unit-tested. #1755 stays open for the shell demo that consumes it.
