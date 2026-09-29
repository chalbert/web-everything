---
bornAs: x89vi71
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/health-smells/pr-stage-stall.mjs", "we:scripts/conveyor/health-smells/github-app-token.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/health-smells/__tests__/pr-stage-stall.test.mjs", "we:scripts/conveyor/health-smells/__tests__/github-app-token.test.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2908's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/health-smells/pr-stage-stall.mjs:40` — Add a lint or test rule that any smell reading `pr.comments` must go through a trusted-author filter. A shared `trustedComments(pr)` helper would be the deterministic gate. Also add a forged-author fixture test to the smell test template.
2. `we:scripts/conveyor/health-smells/github-app-token.mjs:36` — A core health-watch rule that separate subjects with disjoint probes must be defined as separate smells, so one probe's failure naturally skips only its own evaluation without bypassing the safety net.
3. `we:scripts/conveyor/health-watch.mjs:664` — A test for `tick()` that overrides `now` and asserts the probe behaves according to the overridden clock.
4. `we:scripts/conveyor/health-smells/github-app-token.mjs:5` — A unit test that strictly mocks the `evaluate` input based on the `probes` array (e.g. `runHealthTick` stripping unrequested probes), or a schema lint rule that ensures all destructured arguments in `evaluate` are present in `probes`.
5. `we:scripts/conveyor/health-smells/github-app-token.mjs:72` — A unit test asserting the exact recommendation string for a nearly empty bucket.
6. `we:scripts/conveyor/health-smells/github-app-token.mjs:27` — A static lint rule (e.g. in `check:standards`) that parses `evaluate` signatures for destructured arguments and cross-references them against the `probes` array to ensure all consumed probes are declared.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2908@de5477a25ce00da6272695f37597709ecc05e4b7

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
