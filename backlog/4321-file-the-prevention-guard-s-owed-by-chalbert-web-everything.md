---
bornAs: xcgfm2h
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/review-extra-seats.mjs", "we:scripts/operations/__tests__/review-extra-seats.test.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2817's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/review-extra-seats.mjs:161` — Add deterministic migration tests using pre-split scorecards and the shared reservation ledger, checking that completed Gemini calls retain their budget charge and are not reassigned to Codex through legacy reservations.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2817@5bbb2d122d1b051b4185ec3e70873608b400d945

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
