---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/review-job.mjs", "we:scripts/operations/__tests__/review-job.test.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Add a test that spawns we:scripts/operations/review-job.mjs run --prefer-lane=N with injected fake effe… (from chalbert/web-everything#3795 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/review-job.mjs:611` — Add a test that spawns `we:scripts/operations/review-job.mjs run --prefer-lane=N` with injected fake effects, or extract the CLI argument parsing into an exported function that the tests can call.
2. `we:scripts/operations/review-job.mjs:251` — Add a deterministic adapter-boundary regression test that captures the lane-pool subprocess arguments; removing the --lane forwarding must make that named test fail.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3795@5ebdeb3ba9c95bc3b6e84ceed1b95b00c584360b

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
