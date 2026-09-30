---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/__tests__/gh-app-shim.test.mjs", "we:scripts/lib/gh-app-shim.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Prevention — Add a review-lens or checklist rule: every "never throws/replays" sentence in a backlog or comment need… (from chalbert/web-everything#3219 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/__tests__/gh-app-shim.test.mjs:890` — Add a review-lens or checklist rule: every "never throws/replays" sentence in a backlog or comment needs a named negative-path test. A script could flag `catch` blocks in generated-shim templates with no test referencing their warning string.
2. `we:scripts/lib/__tests__/gh-app-shim.test.mjs:940` — Add a fixture case where GH_CALLER and WE_GH_THROTTLE_OUTER_INV carry the token and argv carries a secret flag value, then assert the raw ledger lacks all of them. The fuller guard is a test that enumerates the allowed ledger-row keys, so any new field fails unless it is reviewed.
3. `we:scripts/lib/gh-app-shim.mjs:335` — A design lint or review mandate requiring that secondary telemetry/logging operations within a fallback path must be isolated in a fail-safe `try/catch` block that preserves the primary payload.
4. `we:scripts/lib/__tests__/gh-app-shim.test.mjs:925` — Property-based testing or a comprehensive fixture generator that tests all permutations of optional data models.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3219@483e2832777fa7745f3e5f1ec7bfaeb6adba9479

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
