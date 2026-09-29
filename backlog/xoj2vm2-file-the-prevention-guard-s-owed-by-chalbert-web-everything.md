---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/conveyor/__tests__/tick-core.test.mjs", "we:scripts/readiness/__tests__/dispatch-plan.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2862's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/readiness/dispatch-plan.mjs:1039` — Have `dispatchPlan` return `{activeCount, room}` on the plan object, so the printing layer displays the value the core used and does not recompute it. Add a test that a plan with launches plus holds reports room 0.
2. `we:scripts/conveyor/__tests__/tick-core.test.mjs:1704` — Add a deterministic exact-array assertion for the withheld lane IDs to the existing summary-note test.
3. `we:scripts/readiness/__tests__/dispatch-plan.test.mjs:914` — Add table-driven exact-output assertions for negative, undefined, and fractional active counts.
4. `we:scripts/readiness/dispatch-plan.mjs:245` — A mutation testing gate that breaks the clamping logic (e.g., removing the `Math.max(0, ...)` wrapper) and requires a test to fail, ensuring all edge-case branches are covered.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2862@16451f3778a73a6c1ec3a66f00140cde0be7548d

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
