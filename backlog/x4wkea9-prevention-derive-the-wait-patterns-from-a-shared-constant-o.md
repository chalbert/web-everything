---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/health-pr-attempts.mjs", "we:scripts/conveyor/health-smells/repeated-pr-attempts.mjs", "we:scripts/conveyor/__tests__/health-pr-attempts.test.mjs", "we:scripts/conveyor/health-smells/__tests__/repeated-pr-attempts.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Derive the wait patterns from a shared constant or builder exported by the producer. Alternatively, add… (from chalbert/web-everything#3283 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/health-pr-attempts.mjs:21` — Derive the wait patterns from a shared constant or builder exported by the producer. Alternatively, add a producer/consumer contract test that feeds real `refusals[].why` strings into isExpectedPrWait.
2. `we:scripts/conveyor/health-pr-attempts.mjs:18` — Add a test that iterates REFUSAL_KINDS and asserts each kind is either in BENIGN, exempted by isExpectedPrWait, or on an explicit counts-as-attempt list.
3. `we:scripts/conveyor/health-smells/repeated-pr-attempts.mjs:14` — Add a deterministic migration regression test using the previous writer’s row shape for genuine failures with gate-prefixed reasons, asserting that the breach remains present.
4. `we:scripts/conveyor/health-pr-attempts.mjs:12` — A unit test that asserts the exact behavior of `isExpectedPrWait` against an actual row object produced by `foldPrAttempts`, rather than passing a manually crafted string to it.
5. `we:scripts/conveyor/health-pr-attempts.mjs:10` — A strict linter rule that warns on unused or impossible condition branches (though difficult without strong types).

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3283@cb7317e3345d2b2c8370e2c8baaa201a18ff7de8

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
