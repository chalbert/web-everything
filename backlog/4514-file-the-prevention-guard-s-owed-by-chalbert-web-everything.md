---
bornAs: xvprtq3
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/readiness/__tests__/dispatch-plan-already-done-bounded-spawn.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2969's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/readiness/__tests__/dispatch-plan-already-done-bounded-spawn.test.mjs:163` — Add a deterministic integration test that seeds fresh positive and negative verdicts, runs with the bypass flag, asserts every stale id is queried and fresh results are applied, and verifies the existing store remains unchanged.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2969@8463550d6c465421ffda6fc27904cd2ee6d97f9c

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
