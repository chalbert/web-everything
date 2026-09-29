---
bornAs: x4lc8cv
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/__tests__/build-dispatch-policy.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2924's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/__tests__/build-dispatch-policy.test.mjs:58` — A deterministic mutation testing gate (e.g. Stryker) that automatically mutates RHS assignments like `busy = running.length` to `busy = 0` and demands at least one test redden.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2924@0909cb6c87580dcf2f4ff3c8f28af30af3910b2d

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
