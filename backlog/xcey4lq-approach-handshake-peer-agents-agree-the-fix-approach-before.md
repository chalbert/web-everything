---
kind: story
size: 3
parent: "2410"
status: open
dateOpened: "2026-07-11"
relatedReport: reports/2026-07-11-backlog-split-analysis.md
tags: []
---

# Approach handshake — peer agents agree the fix approach before any code

A pre-diff plan-handshake: the two peer agents agree on the fix approach before writing code, so negotiation rounds aren't burned on wrong-target fixes. Adds a plan-phase reducer + mandate alongside buildEditorMandate/deriveNegotiationOutcome in we:scripts/lib/review-core.mjs, fixture-driven. Slice A of epic #2410.
