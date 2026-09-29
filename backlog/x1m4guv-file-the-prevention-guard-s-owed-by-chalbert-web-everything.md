---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/readiness/heavy-admission.mjs", "we:scripts/readiness/__tests__/heavy-admission.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2845's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/readiness/heavy-admission.mjs` — Add deterministic regression tests for null idle attributes and null idle-array entries, requiring fallback or omission rather than a fabricated zero.
2. `we:scripts/readiness/__tests__/heavy-admission.test.mjs` — Change the fixture to pressure readings [2,2,1] and assert the latest reading admits; this deterministic regression test distinguishes latest selection from median selection.
3. `we:scripts/readiness/heavy-admission.mjs` — Use strict type-checking or the same `val == null ? NaN : Number(val)` guard.
4. `we:scripts/readiness/heavy-admission.mjs` — Add an explicit branch in the fallback ternary chain for `decision.pressureLevel != null`.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2845@1bb9c9117ae72ceefa0ac0b45dddc162199c38cd

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
