---
bornAs: xmyt6nm
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/__tests__/run.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3174's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/__tests__/run.test.mjs:58` — When adding a positive-control test next to a negative one, mutate the guarded code to fail unconditionally and confirm the control reddens. A review-lens checklist item on control tests is enough. No deterministic gate is practical.
2. `we:scripts/operations/__tests__/run.test.mjs:58` — Give spawned CLI fixtures an allowlisted env (PATH, HOME pointed at a temp dir, the two store dirs, no GH/agent tokens). Add a lint rule for `spawnSync(..., {env: {...process.env}})` in test files that run operation CLIs, or make the test helper own the env.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3174@1f01548db1569f8d9810e257da7f0021f73407ae

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
