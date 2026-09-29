---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/run-rating.mjs", "we:scripts/conveyor/__tests__/run-rating.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2942's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/run-rating.mjs:1288` — Make the resolver tri-state: true, false when a card is found without preparedDate, and null or undefined when the card is unresolvable. Add a test that the comparison excludes unresolvable rows. A review-lens note is enough: any 'absence of evidence' default that feeds a bucketed report needs an explicit unknown bucket.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2942@fa846b1e164dddf31dec1588135fbde7c924a774

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
