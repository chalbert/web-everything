---
kind: task
status: open
dateOpened: "2026-08-25"
tags: []
---

# A PR body's gate line must be the CI result, not a local run

A PR body reporting a local `npx vitest run` states a fact about the author's machine and presents it as the
required check's state. On PR #1561 the body said **99 passed** while `test` and `test-shard (1)` were RED at
that head, because the passing run needed a `claude` binary CI does not install. Round 2 owed a weaker rule —
re-run the gate line when an edit changes the case count — which this subsumes: the number must describe CI,
and a carried-forward one never does.

## Done when

1. **Executable** — a check that reddens on a PR body whose Gate section reports a test count with no CI run
   backing it, and passes when the number comes from the required check. Provisional shape: extend
   `we:scripts/check-backlog-workflow.mjs` (or the PR-body linter it fronts) to require the Gate section to
   cite a run id / conclusion for the `test` check, and to refuse a bare local-invocation line. Verify against
   #1561's round-3 body (must flag: `npx vitest run` … 99 passed over a red `test`) and its round-4 body (must
   not).

Owed as prevention by the round-2 and round-3 correctness reviews of #1561. The same round's other half is
filed alongside this one as "A subprocess PATH-resolution test must be run once against a PATH stripped of
ambient dev tools".
