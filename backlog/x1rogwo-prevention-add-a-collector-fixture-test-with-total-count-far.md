---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/credential-inventory.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/health-smells/credential-inventory-stale.mjs", "we:scripts/conveyor/__tests__/credential-inventory.test.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs", "we:scripts/conveyor/health-smells/__tests__/credential-inventory-stale.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a collector fixture test with total_count far above one page and mostly out-of-window runs, asserti… (from chalbert/web-everything#3355 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/credential-inventory.mjs:82` — Add a collector fixture test with total_count far above one page and mostly out-of-window runs, asserting early termination and ci.complete true. Longer term, a pagination-contract helper that requires a stop condition other than total_count for time-ordered listings.
2. `we:scripts/conveyor/credential-inventory.mjs:59` — Add a deterministic regression test with multiple pages of historical failures and a later repository, asserting bounded historical requests and complete collection for the later repository; implement a time-bounded query or pagination strategy that preserves the intended updated-time semantics.
3. `we:scripts/conveyor/credential-inventory.mjs` — An integration test that mocks a `total_count` greater than the pagination limit while providing only old runs past the first page, asserting that the collector terminates successfully.
4. `we:scripts/conveyor/health-watch.mjs` — An integration test that runs the health tick three consecutive times without advancing time, asserting that the probe fires exactly once, exposing the state-wipe on the second tick.
5. `we:scripts/conveyor/health-smells/credential-inventory-stale.mjs` — Including the original `updated_at` in the normalized `ciFinding` schema and using it for time-window checks.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3355@1e52c139b05c53353a8ec5b3af13370fc16ba630

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
