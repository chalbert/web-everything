---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/prepare-pr.mjs", "we:scripts/operations/__tests__/prepare-pr.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3078's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/prepare-pr.mjs:8` — Have the dispatch daemon or `lane-pool acquire --purpose=conveyor-prepare-item` record the purpose on the lane. open-pr would then key the guard on that lane metadata rather than on the ref name. Alternatively, add a check:standards rule that the prepare-item brief's `--ref=` template matches `prepareItemFromRef`.
2. `we:scripts/operations/prepare-pr.mjs:8` — Have the dispatcher or lane-pool record the assigned prepare item and purpose in the lane claim. Have open-pr read that and refuse a prepare-purpose lane whose ref or title does not match. Add a regression test for the old ref shape. As a cheaper interim gate, make a standards check fail if any prepare-item brief `--ref=` template does not match `prepareItemFromRef`.
3. `we:scripts/operations/__tests__/prepare-pr.test.mjs:60` — Add a per-throw coverage expectation for new guard functions. A mutation-testing or branch-coverage threshold on `we:scripts/operations/prepare-pr.mjs` would catch untested refusals.
4. `we:scripts/operations/__tests__/prepare-pr.test.mjs:48` — Add a deterministic boundary test with deliberately incorrect incoming metadata, asserting the fixed title in the spawned arguments.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3078@b262ef7cc454917c338b969c7b6fa2db5320f120

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
