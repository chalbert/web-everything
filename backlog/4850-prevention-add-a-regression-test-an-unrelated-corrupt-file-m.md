---
bornAs: xlz0cwo
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/timeout-retry-state.mjs", "we:scripts/operations/ci-heal-pr-dispatch.mjs", "we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/__tests__/timeout-retry-state.test.mjs", "we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs", "we:scripts/conveyor/__tests__/reconcile-pass.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Add a regression test: an unrelated corrupt file must not change another PR's budget. Scope the corrupt… (from chalbert/web-everything#3559 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this PR's latest advisory review named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/timeout-retry-state.mjs:13` — Add a regression test: an unrelated corrupt file must not change another PR's budget. Scope the corruption error to files whose evidence matches (repo, pr, head).
2. `we:scripts/operations/ci-heal-pr-dispatch.mjs:490` — Skip or retire pending entries whose observed PR is closed or merged, or whose age exceeds a cap. Add a test that a closed PR's pending state stops polling.
3. `we:scripts/operations/ci-heal-pr-dispatch.mjs:451` — Add a check:standards rule that flags template interpolation of fields from `parseTimeoutFailures` into scaffold digests unless passed through a single-line, length-bounded sanitizer. Or restrict names to a conservative charset at parse time and refuse otherwise.
4. `we:scripts/conveyor/reconcile-pass.mjs:1257` — Add a deterministic classifier regression for deleted dependencies with resolution fallbacks; conservatively reject source deletions until dependency resolution is compared against the base.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3559@73b10d286aa18f8c6d50968d32ddacf073f25f6a

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
