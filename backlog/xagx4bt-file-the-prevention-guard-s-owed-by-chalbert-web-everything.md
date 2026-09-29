---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/__tests__/reconcile-pass.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2990's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs:36` — Inject `readRequiredChecks: () => ({checks: [...], source: 'fallback'})` in this test, or assert `requiredChecks: expect.any(Array)`. Longer term, add a test-helper or lint rule that forbids calling `runReconcilePass` without `readRequiredChecks` injected.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2990@470fb72cc552e8b14470938124d8a947cf4610e9

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
