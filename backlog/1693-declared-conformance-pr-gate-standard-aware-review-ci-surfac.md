---
kind: story
size: 5
parent: "142"
status: open
locus: plateau-app
blockedBy: ["1689"]
dateOpened: "2026-06-23"
tags: []
---

# Declared-conformance PR gate (standard-aware review, CI surface)

Slice A of the standard-aware review assistant (#1640, ratified go): a diff-aware gate that holds changed files against the project's declared contracts/intents/rules and fails a PR on conformance drift, run over the example apps. Mirrors the existing plateau:scripts/check-render-conformance.mjs ratchet pattern; scoped as the review-time lens over the #095 conformance core, not a second engine. Reads the per-app declared-rule registry (#1689). Home plateau:conformance-engine.
