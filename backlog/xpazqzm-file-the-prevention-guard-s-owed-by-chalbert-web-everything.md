---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3024's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:skills-src/conveyor/build-dispatch-daemon.mjs:352` — Add a test in we:build-dispatch-daemon.test.mjs for a foreign-host claim past the TTL with no worker. Then either add a hard-age backstop for unprobeable owners or document that they are retired only via PR or stamp.
2. `we:skills-src/conveyor/build-dispatch-daemon.mjs:347` — Add a test for a claimless candidate re-offered after a prior settled prepare with an old merged PR. Bound `currentSettled` by a recency window, or by the card's last-modified time on main.
3. `we:skills-src/conveyor/build-dispatch-daemon.mjs:790` — Add deterministic reader tests for command failures, missing content, and unsupported encoding on both main and open-PR reads; assert rejection rather than an unstamped result.
4. `we:skills-src/conveyor/build-dispatch-daemon.mjs:341` — A true integration test that exercises the full flow from `acquirePrepareClaim` to `cliReadPrepareStatus` without mocking the `claimedAt` payload, or a type system enforcing the shape of the `meta` object.
5. `we:skills-src/conveyor/build-dispatch-daemon.mjs:344` — An integration test using the actual file lock implementation to verify dead owner timeouts, rather than a test that mocks the lock object with non-standard properties.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3024@2717cba0870e7be08ae64cceb8812bba4682ed34

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
