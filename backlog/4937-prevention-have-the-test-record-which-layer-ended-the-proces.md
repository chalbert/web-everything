---
bornAs: xv4qykt
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/__tests__/runner-activity-io.test.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Have the test record which layer ended the process (CLI exit status and signal) and fail with a distinc… (from chalbert/web-everything#3739 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/__tests__/runner-activity-io.test.mjs:63` — Have the test record which layer ended the process (CLI exit status and signal) and fail with a distinct message when the watchdog killed it, so a hang and a slow-but-finishing run are distinguishable in CI output. Add a ratchet or lint on timeout margins relative to the configured deadline.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3739@73ff34d53b3effadf5049bb0f78063a7aefd7edf

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
