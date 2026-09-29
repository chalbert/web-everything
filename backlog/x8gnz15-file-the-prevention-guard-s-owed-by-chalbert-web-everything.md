---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/readiness/__tests__/dispatch-plan.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3011's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/readiness/dispatch-plan.mjs:584` — Add a test that builds the queue through the real tick or backlog-load path (for example the `cliPlanTick` to `dispatchPlan` seam) and asserts a needs-prepare candidate is planned. Also validate queue-item `kind` against the item-kind enum so a launch kind is rejected.
2. `we:scripts/readiness/dispatch-plan.mjs:582` — Add a test or lint that runs the queue-build path (`kind: it?.kind`) with a card-declared launch-kind value and asserts the holds still apply. Better, carry the exemption on a planner-set field such as `launchKind` that card frontmatter cannot supply.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3011@a6530b7cc3def9271ea09c3710b48e5a65f5f635

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
