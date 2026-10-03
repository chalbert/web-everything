---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/review-hold-reconcile.mjs", "we:scripts/conveyor/__tests__/review-hold-reconcile.test.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Add a gate-invariants test that runs planReviewHoldCleanup over every label set decideParkToHuman can p… (from chalbert/web-everything#3657 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this PR's latest advisory review named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/review-hold-reconcile.mjs:107` — Add a gate-invariants test that runs planReviewHoldCleanup over every label set decideParkToHuman can produce and asserts it does not flag them. File this as a backlog item.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3657@aa484dd49d38b698e75920e0092a910e4700b9b2

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
