---
bornAs: xn96zu1
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/lane-salvage.mjs", "we:scripts/conveyor/lane-pool-health-watch.mjs", "we:scripts/lane-whois.mjs", "we:scripts/lib/__tests__/lane-salvage.test.mjs", "we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs", "we:scripts/__tests__/lane-whois.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2884's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/lane-salvage.mjs:214` — Add a real-git test to we:lane-salvage.test.mjs that leaves a deletion in place and asserts the lane eventually reads quiet, using an injected clock or a deletion-age source. That decides the class of 'fallback that can never age out'.
2. `we:scripts/conveyor/lane-pool-health-watch.mjs:716` — Add a health-watch test that feeds a `{kept:true, keptReason}` outcome to the plain summary path and asserts the printed reason is `keptReason`.
3. `we:scripts/lib/lane-salvage.mjs` — A lint rule or write-gate forbidding passing arrays containing potential `undefined` values directly to `.includes()` without a `.filter(Boolean)` step.
4. `we:scripts/lane-whois.mjs` — A lint rule or write-gate forbidding passing arrays containing potential `undefined` values directly to `.includes()` without a `.filter(Boolean)` step.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2884@ee7f01169723c1f9f8d7ab4afe6dff36158db247

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
