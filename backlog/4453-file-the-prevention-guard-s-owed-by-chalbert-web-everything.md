---
bornAs: xxe02pm
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/fix-procedure.mjs", "we:scripts/conveyor/__tests__/fix-procedure.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2860's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/fix-procedure.mjs:213` — Add a fix-procedure test for reentrant draft-then-plain fix-begin. Alternatively, have `fix-end` read the live `isDraft` from `gh pr view` rather than trusting claim meta.
2. `we:scripts/conveyor/fix-procedure.mjs:213` — Add a deterministic test that acquires normally, reacquires with an explicit draft reason, checks persisted metadata and derived status, then verifies fix-end removes the reason label.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2860@6b9f7e181c254a05509ceadc175e2a0eb749153b

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
