---
type: idea
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: conformance-autofix-demo
tags: []
---

# Conformance auto-fix playground — interactive propose/verify/accept-revert surface

A dev-surface playground for the conformance auto-fix loop (scripts/autofix), mirroring the Code Upgrader playground (demos/code-upgrader-demo.*): each card runs a scripted (no-key) model fixer over a fixture failure and shows failure → proposed diff → verify badge → accept/revert, so a human can watch and drive the loop interactively. Builds on the engine's #293 review hook (autofix decide → accept/revert) and lineDiff/formatDiff diff surfacing, and the model-fix cost bound. Split from #293 deliverable 3 (the two headless engine/CLI pieces — cost bounds + --review diff — shipped there; this is the interactive surface over them).
