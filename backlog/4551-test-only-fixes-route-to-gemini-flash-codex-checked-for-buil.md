---
bornAs: x3y1d1u
kind: story
size: 3
tier: pinned
status: resolved
scope: ["we:scripts/lib/provider-routing.mjs", "we:scripts/operations/probation-build-run.mjs", "we:scripts/operations/probation-heal-run.mjs", "we:scripts/lib/dispatch-task-type.mjs"]
dateOpened: "2026-09-29"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
preparedDate: "2026-09-29"
tags: []
---

# Test-only fixes route to Gemini Flash (Codex-checked) for builder, workers and ci-heal

Operator direction 2026-09-29 ~7 PM ET: fixing tests should always be delegated to Flash, by the builder and by workers. Today a failing or flaky test costs a full Claude/Codex session (e.g. #4473 blocked on a non-hermetic run-rating test; #2974 on a slow CLI test; #3001 on a host-cached required-checks assertion). MVP: a new taskType `test-fix` (a diff that touches only test files, e.g. **/__tests__/**, *.test.*, and fixtures) opened in `CRITICAL_WORK_GATE` with roster [antigravity-gemini] at model gemini-3.8-flash-high, simpleOnly lifted for this taskType, and the existing Codex `checker` kept. ci-heal and the delivery flows classify a red CI whose failing files are all tests as `test-fix` first. Escalation: if Flash reports the production code is wrong, or its diff touches non-test files, the envelope refuses and it falls back to the normal route. Files: we:scripts/lib/provider-routing.mjs, we:scripts/operations/probation-build-run.mjs, we:scripts/operations/probation-heal-run.mjs, we:scripts/lib/dispatch-task-type.mjs. Test: a test-only diff is routed to Flash; a mixed diff is refused by the envelope. Proof: replay one of the three live cases above with Flash and show a green PR. Soak break: revert the routing, and test fixes go back to Claude.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## Prep

Design/MVP: classify test-only scope or a supplied all-test failing-file list as `test-fix`.
Reuse the probation gate and Flash roster with the existing Codex checker; test-fix satisfies simpleOnly.
Bound the worker diff to 150 LOC / 3 files and refuse any non-test path, retaining the normal fallback.
Reuse the build/heal launchers; production-code repairs must leave the test-fix route.
CI-heal follow-up: supply structured failing files at dispatch; today the decision has check status/names only.
