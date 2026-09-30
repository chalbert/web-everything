---
bornAs: xh98vyj
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/probation-build-run.mjs", "we:scripts/operations/build-dispatch-hold-route-land.mjs", "we:scripts/operations/__tests__/probation-build-run.test.mjs", "we:scripts/operations/__tests__/build-dispatch-hold-route-land.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3034's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/probation-build-run.mjs:493` — Bound the scan: try only the last few column-0 '{' candidates, or skip capture when !r.ok. Add a size or timing test with a large stream plus a stderr tail.
2. `we:scripts/operations/build-dispatch-hold-route-land.mjs:164` — Add a prepare-side test that a 'possible blocker' id is verified (card exists and is open) before blockedBy is set. Alternatively drop the docs sentence until the consumer exists.
3. `we:scripts/operations/probation-build-run.mjs:599` — Extend the freshness regression test with an unchanged log explicitly referenced by a report containing no final message, and require an empty captured message.
4. `we:scripts/operations/probation-build-run.mjs:497` — A lint rule forbidding unbounded `.slice().join()` inside loops, or a property-based test generating large stream outputs with trailing garbage to assert bounded execution time.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3034@70619765cef5c33a826a72bd43594cb3d5617561

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
