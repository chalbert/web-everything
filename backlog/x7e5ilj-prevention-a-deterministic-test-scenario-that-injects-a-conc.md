---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/ci-heal-mark.mjs", "we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — A deterministic test scenario that injects a concurrent label addition exactly during the gh pr edit ex… (from chalbert/web-everything#3475 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/ci-heal-mark.mjs:186` — A deterministic test scenario that injects a concurrent label addition exactly during the `gh pr edit` execution window to assert how the script recovers or reports the breach.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3475@442a00342e7fa9abb130bc1e62ff88283453c0a0

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
