---
bornAs: x48d7sp
kind: story
size: 5
parent: "2555"
status: resolved
tags: [plateau-loop, console, console-board, read-model, state-machine]
dateOpened: "2026-07-18"
dateStarted: "2026-07-19"
dateResolved: "2026-07-19"
graduatedTo: "plateau-app:src/backlog-view/card-state-read-model.ts"
---

# Board read-model: real lane + drain + PR-label state → the 37 card-states

The board renders 37 card-states; this story is the data source that MAPS real system state into them — the
thin layer the validity review found is the only genuinely-new part of the "PR-state lifecycle" (the rest is
already shipped/codified). Serves G1/G4. Consumes, does not rebuild:
- build-side state — `we:scripts/merge-ai-prs.mjs` + the build endpoint (#2530, resolved);
- **PR-label lifecycle** — the codified label function (#2281) + its build (#2421);
- queue / lease / stuck-lane — the resolved read-surfaces (#2471, #2477).

## Scope
- A pure mapping `{ lane, lease, drain-position, PR-label, progress } → card-state (UC-id)` covering all 37
  states — the single place "what state is this item in?" is decided for the board.
- Derive the chips (bounced ×N, held-Nh age, waiting-on-#X, built-under-ruling) from the same real signals.
- Provider-agnostic per [#2558] — reads through the adapter seam, no bare CLI in the mapping.

## Acceptance
Given real lane + drain + label + progress, the read-model returns the correct card-state + chips for each of
the 37; [#2555]'s card-state rendering consumes it; the mapping is unit-tested against fixtures for every state.
