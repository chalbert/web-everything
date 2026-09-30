---
bornAs: xi0vuj4
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3037's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/reconcile-fix-dispatch.mjs:723` — Add a wiring test per producer/consumer pair, and for claim-metadata fields a contract test that a dispatcher-written claim round-trips through the list function into the planner.
2. `we:scripts/conveyor/reconcile-fix-dispatch.mjs:1113` — Add a deterministic integration test with overlapping candidates where the first fails before starting and assert the second dispatches; track same-pass reservations after successful dispatch or resume.
3. `we:scripts/conveyor/reconcile-fix-dispatch.mjs:98` — A static analysis gate (like ESLint's `import/named` rule) run during `check:standards` to verify that named imports actually exist in their target modules.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3037@1e1758212ed45af9f2920b2777b791ea3d4cce56

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
