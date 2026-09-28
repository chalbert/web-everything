---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/build-dispatch-policy.mjs", "we:scripts/conveyor/__tests__/build-dispatch-policy.test.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2814's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/build-dispatch-policy.mjs:191` — A coverage gate that requires, for every BUILD_DISPATCH_POLICY rule whose enforcedBy names this file, at least one test asserting planBuildDispatch actually returns a `hold` with that rule id from varying (not hardcoded-compliant) inputs — i.e., test the integration point, not just the underlying pure helper.
2. `we:scripts/conveyor/build-dispatch-policy.mjs:180` — Add a deterministic planner regression test covering disjoint, partially overlapping, and identical claimed/externally counted build sets, asserting that their union never exceeds the configured cap.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2814@ad77a84b1deaede34f065683fa0ebc4469335c10

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
