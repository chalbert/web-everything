---
bornAs: xx9mgt4
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/probation-build-run.mjs", "we:scripts/lib/provider-routing.mjs", "we:scripts/operations/__tests__/probation-build-run.test.mjs", "we:scripts/lib/__tests__/provider-routing.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3021's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/probation-build-run.mjs:158` — Add a `parseArgs` check that the resolved worker id is in `PROBATION_ROSTER[taskType]`, with a test. Alternatively add a roster-membership assertion to the launcher's shared arg validation.
2. `we:scripts/lib/provider-routing.mjs:398` — Add a table-driven `isTestPath` / envelope test that always includes empty and undefined path lists as rows. A lint rule for `.every(` on unguarded arrays is also possible.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3021@1d6e5a2cb44a9df86aa9fa861ec9b32787614a3c

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
