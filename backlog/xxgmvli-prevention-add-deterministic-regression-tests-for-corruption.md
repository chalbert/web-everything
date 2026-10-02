---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/health-responder-state.mjs", "we:scripts/conveyor/__tests__/health-responder-state.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Add deterministic regression tests for corruption with an existing cache and for altered cached receipt… (from chalbert/web-everything#3490 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this PR's latest advisory review named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/health-responder-state.mjs:113` — Add deterministic regression tests for corruption with an existing cache and for altered cached receipts; validate cache integrity against the corresponding segment before trusting it.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3490@7dfd8c8063af7e43d5b8274255a608bd2ec22ac1

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
