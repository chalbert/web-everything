---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/lib/__tests__/gh-throttle.priority.test.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/__tests__/reconcile-pass.test.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3094's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/reconcile-pass.mjs:1003` — Add a test that pipes the deferred result through `formatReport`. More durably, give `notes` one normalizer or type shared by the planner and every early return.
2. `we:scripts/lib/__tests__/gh-throttle.priority.test.mjs:78` — Add a deterministic parameterized test using deferrable:true for mutations and non-list reads, asserting execution below the threshold; verify that removing the command-type guard makes it fail.
3. `we:scripts/conveyor/health-watch.mjs:499` — A unit test asserting that `probePrs` skips gracefully without making network calls when budget is scarce (e.g. `it('skips a deferred discovery pass without clearing smells')`).
4. `we:scripts/conveyor/reconcile-pass.mjs:328` — A static lint rule warning when `isGhDeferred` is checked on a call that wasn't dispatched with `throttle: { deferrable: true }`.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3094@72e195c55b6f158f0074c832ba7ff4aafdf4cea8

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
