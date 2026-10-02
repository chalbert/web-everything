---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/review-set-label.mjs", "we:scripts/__tests__/review-set-label.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — A parameterized test in we:rearm-review.test.mjs that exhaustively checks the generated re-arm comment… (from chalbert/web-everything#3410 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/review-set-label.mjs:389` — A parameterized test in `we:rearm-review.test.mjs` that exhaustively checks the generated re-arm comment for all initial review states, explicitly including `review:pending` and an empty label set.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3410@38dee733abf8557770a60dac23c02a247784643d

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
