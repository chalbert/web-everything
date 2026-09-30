---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/queue-store.mjs", "we:scripts/conveyor/__tests__/queue-store.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3065's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/queue-store.mjs:340` — Add a test that injects a linkSync failure (EPERM) to cover the fallback. More generally, review new catch branches for a test that exercises each error code they handle.
2. `we:scripts/conveyor/queue-store.mjs:338` — Add a small injectable `link` function parameter to writeQueueFileIfAbsent so the fallback branches can be unit-tested. Lower-cost alternative: a review-lens item that every documented fallback branch needs a named test.
3. `we:scripts/conveyor/queue-store.mjs:344` — Add a deterministic filesystem-failure test that forces the fallback and injects canonical publication between its existence check and rename; require preservation of the winning canonical contents. Use a genuinely exclusive publication mechanism or fail without replacing the destination.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3065@b776ad8090a2533b96be21db9565e219897081af

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
