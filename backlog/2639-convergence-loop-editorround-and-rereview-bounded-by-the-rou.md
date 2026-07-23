---
bornAs: xomlggf
kind: story
size: 8
buildQueued: true
parent: "2636"
status: open
blockedBy: ["2638", "2635"]
scope: ["we:scripts/workflows/review-parked-prs.mjs", "we:scripts/lib/review-core.mjs"]
dateOpened: "2026-07-23"
tags: []
---

# Convergence loop: editorRound and reReview bounded by the round-trip cap

The heaviest slice — the body of epic #2285. Build the real fix↔review loop: the panel judges → an editor subagent fixes each finding or dismisses it with a stated reason → the panel re-reviews, repeating until it converges (accept) or hits the **round-trip cap** and deadlocks to `review:human`. No clock anywhere — the bound is passes, not time. Replaces the one-shot MVP in `we:scripts/workflows/review-parked-prs.mjs` (which today does panel→reduce→render only) using the primitives that already exist in `we:scripts/lib/review-core.mjs`: `buildEditorMandate`, `deriveNegotiationOutcome`, `NEGOTIATION_ROUND_CAP`. The cap per care band comes from the config contract. Depends on the prepare charter and the open-bind slices.
