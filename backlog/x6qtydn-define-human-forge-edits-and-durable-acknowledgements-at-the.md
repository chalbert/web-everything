---
kind: decision
status: open
dateOpened: "2026-09-30"
relatedTo: ["3007", "3216", "3179", "4284"]
tags: [review-ledger, product-design]
---

# Define human forge edits and durable acknowledgements at the review ledger authority boundary

Refine the existing ledger-authority direction: decide whether external edits are trusted commands or observations and whether acceptance requires a durable append. Recommend authenticated commands, append-before-projection after the authority flip, and fail-closed clearance; preserve live external merge checks. Design: we:docs/agent/review-state-ledger-target.md.

## Decision to make

#3007 already proposes verdict authority and #4284 already tracks display-only labels. The remaining product fork is how a human forge edit becomes intent, and what a successful command acknowledgement guarantees. Preserve we:docs/agent/platform-decisions.md#event-driven-land-is-wake-only: the sole drain still checks current external facts before mutation.

| Option | Behavior | Consequence |
| --- | --- | --- |
| A. Bidirectional label authority | Last label or ledger write wins | Easy manual edits; recreates clearance races and ambiguous trust |
| B. Ledger authority with authenticated command inputs | Human edits are observations; authorized holds enter command policy; clearances require verified actor and coverage | Explicit intent and audit; needs command UX and outbox |
| C. Ledger-only UI | All forge edits are rejected and repaired | Smallest input surface; inconvenient to operators working on the forge |

Recommend **B**. Removing a hold label or adding accepted cannot grant clearance. Preserve/record unexpected human intent before repairing drift. Unknown provenance holds for reconciliation. External head, CI, human review and merge observations retain their external source authority.

Recommend durable append plus projection intent in one transaction before acknowledging a command; projection is asynchronous/retryable. Failed append cannot acknowledge acceptance. This ordering applies **after** the authority cutover, not to the current shadow writer in we:scripts/review-set-label.mjs, whose ordering has different invariants.

## Relationship to existing work

Coordinate the write-failure subquestion with #3216 after #3255; do not duplicate or silently resolve it here. #3179 owns authenticated human-clearance evidence; #3929 covers missing hold writers; #3930 supplies discrepancy history. The full model and failure cases are in we:docs/agent/review-state-ledger-target.md. No authority flip is authorized by filing this card.

## Done when

Ratify the human-label drift/command rule and command acknowledgement boundary; agree how #3216 carries the implementation consequence. Specify acceptance, hold, store outage, stale coverage and projection outage cases as conformance vectors. Codify the reusable rule and leave the phase-2 implementation/evidence gate with #3007/#4284.
