---
bornAs: xi5yrkt
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/ci-heal-mark.mjs", "we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Add a restore-only test scenario where the comment call fails. It should assert that the exit code and… (from chalbert/web-everything#3488 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/ci-heal-mark.mjs:232` — Add a restore-only test scenario where the comment call fails. It should assert that the exit code and the outcome JSON reflect the partial success. Alternatively, post the comment best-effort and report `commented:false` in the outcome JSON.
2. `we:scripts/conveyor/ci-heal-mark.mjs:186` — Code review focusing on removing redundant network/shell calls in hot CI paths.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3488@e9176cd2c7e3a2820b8a08c8511f23d5629f8ec3

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
