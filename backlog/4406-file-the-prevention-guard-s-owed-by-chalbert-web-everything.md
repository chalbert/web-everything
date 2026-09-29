---
bornAs: xpyelm4
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/ci-heal-owed.mjs", "we:scripts/conveyor/__tests__/ci-heal-owed.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2903's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/ci-heal-owed.mjs:103` — Have readOwedWrites re-derive slug from CONSTELLATION_REPOS[rec.repo].slug, and reject the record if it disagrees, instead of trusting the stored slug. Add a unit test for a tampered record.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2903@f03b153c5c56dc56248fc60ebe823e450e548820

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
