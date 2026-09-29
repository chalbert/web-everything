---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/cli-adapter.mjs", "we:scripts/operations/review-job.mjs", "we:scripts/operations/__tests__/review-pr.test.mjs", "we:scripts/operations/__tests__/cli-adapter.test.mjs", "we:scripts/operations/__tests__/review-job.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2883's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/cli-adapter.mjs:866` — Add a `reduce` test asserting that a `skipped` answer is reported as skipped or unrun (not 'accept') in the verdict output and the posted comment. Before the fix the run crashed, so this is still better than base.
2. `we:scripts/operations/review-job.mjs:197` — Match the last `error: ` line in stdout instead of requiring a prefix, and add a multi-line-stdout test.
3. `we:scripts/operations/cli-adapter.mjs:866` — Key the cwd-withholding rule on the seat (a tool-free / `gracefulOnUnavailable` flag), not on the provider name. Add a test that asserts a fallback request never carries `cwd`.
4. `we:scripts/operations/__tests__/review-pr.test.mjs:2871` — Add a table-driven test over all judge steps that asserts `gracefulOnUnavailable` is true only for the advisory steps. A check:standards rule could also flag the flag appearing in a mandatory-seat request builder.
5. `we:scripts/operations/cli-adapter.mjs:681` — Enforce a branch-coverage floor on new/modified lines (e.g., via Vitest coverage thresholds for changed files) to mechanically flag the untested `catch` block.
6. `we:scripts/operations/cli-adapter.mjs:864` — An AST-based code duplication linter (like jscpd or an ESLint equivalent) integrated into check:standards to flag identically duplicated expressions.
7. `we:scripts/operations/review-job.mjs:180` — Use `.includes('error: ')` or `.match(/(?:^|\\n)error: /)` to locate the deliberate crash message anywhere within `stdout`, rather than enforcing a strict prefix check.
8. `we:scripts/operations/cli-adapter.mjs:101` — Strip `cwd` based on capability instead of a hardcoded string: `cwd && !TOOL_FREE_JUDGE_PROVIDER_NAMES.includes(effectiveProviderName)`.
9. `we:scripts/operations/cli-adapter.mjs:710` — A unit test asserting that all tool-free fallback providers (like `antigravity`) do not receive a `cwd` argument, preventing untrusted file loading.
10. `we:scripts/operations/review-job.mjs:199` — A unit test for `crashLabelFromLoop` passing a multi-line `stdout` string with `error: ` appearing after other text, ensuring it still extracts the error.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2883@4666052696cac39fb6a1616bec856d5a78ee65b8

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
