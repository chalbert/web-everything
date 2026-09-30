---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/__tests__/dispatch-lane-io.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3098's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/dispatch-lane-io.mjs:329` — Add a contract test for `readTick` and `shapeDispatchRead` asserting the held read and the planned read expose the same key set. Also add a dispatch-eligibility test on a held item.
2. `we:scripts/operations/dispatch-lane-io.mjs:334` — Extract the hold decision into one helper that takes `expectedWithinMinutes`, used by both readTick and shapeDispatchRead. Or have readTick accept `expectedWithinMinutes`.
3. `we:scripts/operations/dispatch-lane-io.mjs:567` — Add a readTick unit test whose `listInFlightDispatches` returns empty on the first call and a live row on the second, and assert the row is reported in `inFlightDispatches`. The runNode fake would be the point where the second row arrives.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3098@50fff0eabb898d19559a09109e3420919960ef05

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
