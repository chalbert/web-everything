---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/review-pr-io.mjs", "we:scripts/operations/__tests__/review-pr-io.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Add a review lens, or a test convention, requiring each park-on-error path to name which error classes… (from chalbert/web-everything#3625 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/review-pr-io.mjs:630` — Add a review lens, or a test convention, requiring each park-on-error path to name which error classes are terminal and which stay retryable. A shared `TerminalPersistenceError` class thrown only by the post and read-back paths would make this deterministic.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3625@cdface1cc519da2186caecb527e38024a6ee3777

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
