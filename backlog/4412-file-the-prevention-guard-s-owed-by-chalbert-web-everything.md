---
bornAs: x52sjqd
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/lane-verify.mjs", "we:scripts/__tests__/verify-lane.test.mjs", "we:scripts/lib/__tests__/lane-verify.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2878's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/lane-verify.mjs` — A test coverage rule that requires default arguments of exported functions to be exercised by at least one test without explicit overrides.
2. `we:scripts/__tests__/verify-lane.test.mjs:162` — A testing guideline requiring polling tools to integration-test the target state transitioning *while* the loop is running, not just at start and timeout boundaries.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2878@cf59b9d109a15c4329a60f9970a9086ddd577c9e

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
