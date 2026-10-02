---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/soak-replay-gate.mjs", "we:scripts/lib/__tests__/soak-replay-gate.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Add positive-control tests for noun-compound continuations of each signal word ("no regression test", "… (from chalbert/web-everything#3329 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/soak-replay-gate.mjs:56` — Add positive-control tests for noun-compound continuations of each signal word ("no regression test", "no incident report", "no bug report") to the retained-signals table. Any future classifier-masking regex should come with right-context controls as well as left-context ones.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3329@30f117e6803e688aad31fbab059ca02abd690ffd

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
