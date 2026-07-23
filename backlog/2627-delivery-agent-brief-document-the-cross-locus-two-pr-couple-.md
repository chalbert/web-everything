---
bornAs: x0hmehb
kind: story
size: 2
parent: "2612"
status: resolved
scope: ["we:skills-src/conveyor/"]
dateOpened: "2026-07-23"
dateStarted: "2026-07-23"
dateResolved: "2026-07-23"
tags: []
---

# Delivery-agent brief: document the cross-locus two-PR (couple) flow

The delivery brief documents only a single-repo / single-PR arc, but a cross-locus item — implementation in `frontierui` or `plateau-app`, resolve in `webeverything` — needs TWO coupled PRs: impl-first / WE-last, with the lane manifest carried on the WE PR, and the producer rubric auto-parks both halves.

Surfaced by #2539 (frontierui PR #37 plus WE PR #695): the delivery agent expected one PR and had no brief for the fan-out.

Document the two-PR couple flow in the delivery brief so agents expect it: which repo lands first, where the manifest lives, and how the coupled parks clear together.
