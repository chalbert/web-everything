---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/__tests__/fake-gh-state.test.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Add a deterministic regression test with an early failing child and a delayed writer, asserting cleanup… (from chalbert/web-everything#3668 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/__tests__/fake-gh-state.test.mjs:299` — Add a deterministic regression test with an early failing child and a delayed writer, asserting cleanup starts only after both settle; verify replacing allSettled with all makes that named test fail.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3668@042a93636c3ed0f50e6b40d137d383067a4a5bcb

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
