---
bornAs: x9oqwdv
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/__tests__/probation-build-run.test.mjs", "we:scripts/operations/probation-build-run.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3181's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/__tests__/probation-build-run.test.mjs` — Commit the incident card text as a fixture under `__tests__/fixtures` and replay from it. A standards rule that flags tests reading live `backlog/<num>-*` files would catch the whole class.
2. `we:scripts/operations/probation-build-run.mjs` — Accept any existing in-scope test entry, or derive the expected test location from the repo's layout. Add a test case that uses a non-sibling test entry. A corpus check that replays `missingTestScope` over all open backlog cards would show how many it blocks.
3. `we:scripts/operations/probation-build-run.mjs` — Add a deterministic regression test covering exact test files, narrow test patterns, and covering directory scopes when validating preparation test coverage.
4. `we:scripts/operations/probation-build-run.mjs` — A unit test asserting that a `frontierui:` source correctly demands and accepts a `frontierui:` matching test scope.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3181@0b8a20978650f9f32096f908373d43e79f800975

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
