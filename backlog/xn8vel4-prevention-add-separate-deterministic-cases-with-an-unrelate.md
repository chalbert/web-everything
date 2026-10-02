---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/__tests__/land-overlap-yield.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add separate deterministic cases with an unrelated label and an unlabeled event after the valid event,… (from chalbert/web-everything#3292 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/__tests__/land-overlap-yield.test.mjs` — Add separate deterministic cases with an unrelated label and an unlabeled event after the valid event, each with a later timestamp; assert that the valid readiness time remains unchanged. The named test should redden when either corresponding filter is removed.
2. `we:scripts/conveyor/__tests__/land-overlap-yield.test.mjs:64` — Mutation testing that breaks the implementation (e.g., stripping the `event === 'labeled'` condition) and ensures tests fail.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3292@206f9d7b699c3513aca7cea72bba95ec2009ebe9

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
