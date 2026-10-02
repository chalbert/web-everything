---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/review-extra-seats.mjs", "we:scripts/operations/__tests__/review-extra-seats.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Add a test that iterates every consumer of resolveProviderCap with an empty env and asserts Gemini is n… (from chalbert/web-everything#3497 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/review-extra-seats.mjs:1257` — Add a test that iterates every consumer of resolveProviderCap with an empty env and asserts Gemini is never selected. Better still, compute the effective seat provider set in one shared helper that both paths call.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3497@dfe19f594719cb448fc8b294c58398de0eae727c

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
