---
bornAs: xygrhwb
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/conveyor/fix-dispatch-claim.mjs", "we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs", "we:scripts/conveyor/__tests__/fix-dispatch-claim.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3131's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/reconcile-fix-dispatch.mjs:1451` — Add a property-style test in `we:reconcile-fix-dispatch.test.mjs` asserting that every entry `planFixesFromReconcile` emits for a dispatched fix has a finite `waitingSince`, or a documented fallback such as PR `createdAt`. Add a standards check that a sort comparator does not use a MAX sentinel for missing keys.
2. `we:scripts/conveyor/fix-dispatch-claim.mjs:248` — Add a table-driven test over every terminal state, for both claim retention and release. Where the intended behaviour is release, also assert that a re-dispatch rate limit or per-PR failure cap exists.
3. `we:scripts/conveyor/fix-dispatch-claim.mjs:253` — A unit test that provides an unrelated terminal session alongside a missing/unlisted session in the simulated `agentsAll` array, asserting the claim is retained during spawn lag.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3131@493a88f65af74c3b11df13e8c60b0d48b75508b0

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
