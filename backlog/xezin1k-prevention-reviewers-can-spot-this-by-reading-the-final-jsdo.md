---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/isolation-provider.mjs", "we:scripts/operations/__tests__/codex-delivery-provider-sandbox.test.mjs", "we:scripts/lib/__tests__/isolation-provider.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Reviewers can spot this by reading the final JSDoc. No deterministic gate is worth building for a comme… (from chalbert/web-everything#3376 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/isolation-provider.mjs:353` — Reviewers can spot this by reading the final JSDoc. No deterministic gate is worth building for a comment-only split.
2. `we:scripts/operations/__tests__/codex-delivery-provider-sandbox.test.mjs:29` — Build live sandbox fixtures through the same resolveLane/`git worktree add` path production uses, or add a test-standards rule that sandbox-proof fixtures mirror the production topology. Also run the live suite from a non-default CI job so the claim is checked on CLI upgrades.
3. `(no file cited)` — Lint rules enforcing explicit error checks on spawned processes.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3376@b88de0fed344d16aff047e3277f10d5ded753a73

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
