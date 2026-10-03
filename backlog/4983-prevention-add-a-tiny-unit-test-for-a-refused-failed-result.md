---
bornAs: xte7ljz
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/cli-adapter.mjs", "we:scripts/operations/__tests__/cli-adapter.test.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Add a tiny unit test for a refused/failed result without reason (expect no "undefined" in the lines). O… (from chalbert/web-everything#3800 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/cli-adapter.mjs:1352` — Add a tiny unit test for a refused/failed result without `reason` (expect no "undefined" in the lines). Or add a shared `describeEffectResult` helper that defaults the reason, so every renderer gets the same fallback.
2. `we:scripts/operations/cli-adapter.mjs:1306` — Add a contract test asserting that renderOutcome's exit code is the same in human and --json modes for every stopped state, or a documented, tested rule that JSON consumers must read payload fields. Prefer the parity test.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3800@a52162694c7b6da90212a63a0b9c67cf9f301c69

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
