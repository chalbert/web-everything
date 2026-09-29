---
bornAs: x2gsr9p
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2855's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/deliver-item-wrapper.mjs:353` — When a comment justifies an ordering or atomicity choice, require one test that spies on both calls and asserts their order. A review-lens checklist item is the cheapest route, since a lint rule cannot decide this.
2. `we:scripts/operations/deliver-item-wrapper.mjs:330` — Give release primitives an owner-token parameter that is required by default, so a release by resource key alone has to be an explicit opt-out. A lint or write-gate could flag calls to releaseBuildDispatchClaim that pass no owner. Until then, file a follow-up card for the ownership token.
3. `we:scripts/operations/deliver-item-wrapper.mjs:339` — Persist the non-PR hold before publishing settlement, and add a deterministic fault-injection test that stops after each persistence step and runs a daemon tick to assert that redispatch remains excluded.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2855@a538d451018986910658228b551e5b2825fd4b3c

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
