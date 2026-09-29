---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/readiness/__tests__/dispatch-plan.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2960's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/readiness/dispatch-plan.mjs:564` — Add a tick-core test that iterates every `HELD_REASONS` token through `planTick` and asserts it is either in `HELD_NOTE_EXCLUDED_REASONS` or an explicitly declared 'transient' reason. This is the same class as queue-report's refusal of an unclassified token.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2960@cc6d46fe91c1e4d57e868878289ccd3753767ec9

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
