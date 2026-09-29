---
bornAs: xn2tkkx
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/build-dispatch-policy.mjs", "we:scripts/conveyor/__tests__/build-dispatch-policy.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2857's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/build-dispatch-policy.mjs:45` — Derive the `landing-freeze` rule text from `globalFreezeLabels`, or add a test asserting the rule text mentions the labels actually enforced. Alternatively, note in the review checklist that changes to freeze semantics require a grep for 'freeze label'.
2. `we:scripts/conveyor/build-dispatch-policy.mjs:178` — A strict branch coverage threshold in the test runner (Vitest) that explicitly flags unexercised logical OR / nullish coalescing branches in modified files, forcing a dedicated test case for the fallback.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2857@f4bd30a7cd9ed2f4103d2d5e0323cd44060a1cd5

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
