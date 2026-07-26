---
bornAs: xomlggf
kind: story
size: 8
buildQueued: true
parent: "2636"
status: resolved
blockedBy: []
scope: ["we:scripts/workflows/review-parked-prs.mjs", "we:scripts/lib/review-core.mjs"]
dateOpened: "2026-07-23"
dateStarted: "2026-07-26"
dateResolved: "2026-07-26"
tags: []
---

# Convergence loop: editorRound and reReview bounded by the round-trip cap

The heaviest slice — the body of epic #2285. Build the real fix↔review loop: the panel judges → an editor subagent fixes each finding or dismisses it with a stated reason → the panel re-reviews, repeating until it converges (accept) or hits the **round-trip cap** and deadlocks to `review:human`. No clock anywhere — the bound is passes, not time. Replaces the one-shot MVP in `we:scripts/workflows/review-parked-prs.mjs` (which today does panel→reduce→render only) using the primitives that already exist in `we:scripts/lib/review-core.mjs`: `buildEditorMandate`, `deriveNegotiationOutcome`, `NEGOTIATION_ROUND_CAP`. The cap per care band comes from the config contract. Depends on the prepare charter and the open-bind slices.

## Progress

Done. Replaced the one-shot panel→reduce→render MVP in `we:scripts/workflows/review-parked-prs.mjs` with the real bounded editor↔reviewer convergence loop:

- **Per-PR loop** (`convergePr`): fetch the diff + escalation reason once → dial the care band (`review-core-cli rigor` → jury size **and** the per-band round cap) → loop: fan out the fresh-context multi-lens panel over the current diff → reduce to a verdict **plus the negotiation `outcome`** (`review-core-cli reduce --round` = `deriveNegotiationOutcome`) → on `continue`, an **editor subagent** (`mandate --editor` = `buildEditorMandate`) fixes each finding or dismisses it with a stated reason and pushes the revision to the **same** PR branch → re-fetch + re-review.
- **Bound is passes, not time** — no clock. The round cap is **per care band** (`panelRigorForCareLevel.rounds`, never above `NEGOTIATION_ROUND_CAP`), shelled through the CLI so the round-cap decision is never re-derived in the sandbox.
- **Terminal states**: `land` (accept → converged, reviewer-approved) or `escalate` (round-cap deadlock / needs-human / an editor that could not advance the diff → `review:human`). A failed mandatory reviewer or unfetchable diff degrades that round to needs-human → escalate (a reviewer that did not run never reads as accept).
- **Invariant**: a `land` means the final diff was signed off by a fresh-context panel that did **not** author it (the editor writes; the next round's independent reviewers judge).
- **Boundary preserved (INVARIANT 2)**: the workflow still returns a ledger and applies **no** label / posts **no** comment / **merges nothing** — the editor revising the diff is the loop's own mechanism; the label/merge decision stays the caller's. Ledger entries gain `rounds`, `outcome`, `dismissedFindings` (the editor's audit trail).

Gate green (`check:standards`, 0 errors); the harness-sandbox body parses as an async-wrapped body and the `meta` literal is valid. Live validation awaits a real `review:pending` PR (a harness workflow needs live agents + runtime primitives; not unit-testable).
