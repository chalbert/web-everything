---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/probation-launcher.mjs", "we:scripts/operations/dispatch-providers/build.mjs", "we:scripts/lib/dispatch-routing-policy.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/lib/__tests__/probation-launcher.test.mjs", "we:scripts/operations/dispatch-providers/__tests__/build.test.mjs", "we:scripts/lib/__tests__/dispatch-routing-policy.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-io.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Emit --effort only when the worker carries an explicit effort, and add a table test over every PROBATIO… (from chalbert/web-everything#3311 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/probation-launcher.mjs:57` — Emit `--effort` only when the worker carries an explicit effort, and add a table test over every PROBATION_WORKERS model through buildWorkerArgv and buildAgyDirectTaskArgv. Or add a check:standards rule that flags a default effort injected at a launcher boundary.
2. `we:scripts/operations/dispatch-providers/build.mjs:128` — A deterministic check in the dispatch-provider adapter that falls back to 'codex' or 'claude-restricted' (or relies on the delivery marker) when the policyRoute provider lacks a delivery implementation.
3. `we:scripts/lib/dispatch-routing-policy.mjs:28` — Test coverage for invalid policy edits with `inherit: true` and a string `effort`.
4. `we:scripts/operations/dispatch-lane-io.mjs:1780` — Check that indexOf('--effort') is not -1 before accessing the array element, or default to a known placeholder.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3311@4f38c1ff3b054458f911e1c085406d69d988abc3

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
