---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/__tests__/pr-ownership-io-real.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2842's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/__tests__/pr-ownership-io-real.test.mjs:59` — Add a deterministic missing-checkout test with an injected run spy and assert that it was never called, while retaining the real filesystem existence check.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2842@1a49f07cc1f0f46c1e97c111205d507230b6c3e2

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
