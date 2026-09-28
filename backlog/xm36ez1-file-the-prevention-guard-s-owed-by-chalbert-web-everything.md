---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/run.mjs", "we:scripts/operations/__tests__/run.test.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2815's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/run.mjs:550` — Add a deterministic CLI integration test with a stale checkout fixture that asserts refusal and absence of a run record; removing the CLI preflight invocation must make that named test fail.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2815@6889dc730a6054d5a547e87dc1535b3b2c8ef05f

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
