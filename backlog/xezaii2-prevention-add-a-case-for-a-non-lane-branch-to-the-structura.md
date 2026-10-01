---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/missing-run-push.mjs", "we:scripts/conveyor/__tests__/missing-run-push.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a case for a non-lane branch to the structural-deferral soak break and its unit test. Also add a li… (from chalbert/web-everything#3253 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/missing-run-push.mjs:29` — Add a case for a non-lane branch to the structural-deferral soak break and its unit test. Also add a lint or unit-level rule that every `defer(` call site in `we:scripts/conveyor/missing-run-push.mjs` is justified as transient, to catch structural cases hidden among deferrals.
2. `we:scripts/conveyor/missing-run-push.mjs:30` — A unit test specifically asserting that non-lane branch names result in a counted failure (like the stacked/fork tests do) rather than a free deferral.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3253@f2247f0abf422ce9259b71e418098f8b9da8d942

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
