---
bornAs: x7at0uc
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/health-smells/dispatch-trust-refused.mjs", "we:scripts/operations/__tests__/dispatch-lane.test.mjs", "we:scripts/conveyor/health-smells/__tests__/dispatch-trust-refused.test.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2824's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/health-smells/dispatch-trust-refused.mjs:38` — A check:standards rule that resolves every `we:backlog/<id>-*.md` string literal embedded in source (comments or runtime strings) against the actual backlog directory and flags any that don't match an existing file — the repo already runs a check:standards pass per the PR description, so this slots into existing infrastructure.
2. `we:scripts/operations/__tests__/dispatch-lane.test.mjs:849` — Add an execution counter to the repeated-refusal test and assert exactly two calls; this deterministic assertion guards retry bounds on persistent failures.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2824@636c8553c09ba6415b30343473049cde6aa744b4

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
