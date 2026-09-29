---
kind: task
status: resolved
scope: ["we:scripts/conveyor/run-rating.mjs", "we:scripts/conveyor/__tests__/run-rating.test.mjs"]
dateOpened: "2026-09-29"
dateResolved: "2026-09-29"
tags: []
---

# we:run-rating.test.mjs: buildCoverageReport(sinceMs=now) races real ambient filesystem state, flaky under load

Discovered while delivering #4473: we:scripts/conveyor/__tests__/run-rating.test.mjs line 849's buildCoverageReport test ('never claims more than 100% ... when files exist') calls the REAL buildCoverageReport({ sinceMs: Date.now() }) with no mocked filesystem — it assumes an impossible since means every real bucket reads empty (report.totalTokens toBe 0), but the underlying scanners read live, ambient, shared host state (session transcripts under the real ~/.claude/projects tree, real review-juror run logs) that OTHER concurrent processes on a shared multi-lane host keep writing in real time. Reproduced: passes reliably in quick isolation (3/3), but failed 3/3 real times when picked up by the actual verify-lane dispatch daemon (a much longer, ~60-90s combined vitest+check:standards window), with AssertionError: expected a nonzero byte count to be +0. This surfaced under #4473 only because we:scripts/conveyor/__tests__/run-rating.test.mjs line 136 contains the literal string we:scripts/verify-lane.mjs inside an unrelated classifyToolCall example command, which the diff-driven selection's basename-needle grep (we:scripts/readiness/test-selection.mjs's referencedTestNeedles/testsNaming) treats as a real reference, sweeping this unrelated, non-hermetic test into the gate for ANY lane that touches we:scripts/verify-lane.mjs, we:scripts/lib/lane-verify.mjs, or we:scripts/lib/verify-lane-gate.mjs. Two independent, separately-scoped fixes worth doing: (1) make buildCoverageReport's own test hermetic — inject/mock the scan root(s) (session-transcript dir, review-juror log dir) instead of reading the real live paths, so 'when files exist' asserts against a controlled empty directory, not ambient host state; (2) separately, tighten the needle-match heuristic (or accept it as a documented false-positive class) so an incidental string mention of a filename inside an unrelated fixture/example does not count as a real reference. Edge cases to name for whichever is picked up: a test file that legitimately DOES cover the changed file plus also happens to mention an unrelated one in an example string (must not lose real coverage while dropping the false positive); a scan-root mock that must still exercise the real 'files exist' branch with deterministic fixture data. Needs a wiring test proving the fix under real concurrent load (or at minimum, a repeated-run stress assertion) since the whole point is this only manifested under real host contention, not a single clean run.

Fix (2) (the needle-match heuristic) is split out to its own card, xaani98, and NOT closed here — this card
resolves once fix (1) (the hermetic test) is landed.

## Done when

1. **Executable** — `node we:scripts/readiness/heavy-admission.mjs run -- npx vitest run we:scripts/conveyor/__tests__/run-rating.test.mjs --run --passWithNoTests`
   passes, including a `buildCoverageReport` test that points `projectsRoot`/`runsDirs`/`home` at isolated
   directories (never the real `~/.claude/projects` / workspace `.operations/runs` / `~/.codex-judge-transcripts`)
   and asserts an EXACT token total from known fixture files — a regression back to the real, unmocked scanner
   defaults would almost certainly change that total (the real host has far more than zero ambient tokens lying
   around), which is what makes the isolation itself provable rather than merely assumed.

## Progress

- 2026-09-29 — Fixed under #4473's own PR (same lane, its own commit): `buildCoverageReport`
  (`we:scripts/conveyor/run-rating.mjs`) now forwards `projectsRoot`/`runsDirs`/`workspaceRoot`/`home` to the
  three scanners it calls — the SAME override params `scanClaudeProjectsCoverage`/`scanReviewJurorUsage`/
  `scanNonClaudeJudgeTranscripts` already accepted (their own tests already used them); the only gap was
  `buildCoverageReport` itself never forwarding them, so it always hit the real defaults regardless of what a
  caller wanted. Every other call site (`we:scripts/conveyor/run-rating.mjs`'s own `main()`) omits these new
  params, so its behavior is byte-for-byte unchanged. Mutation-proof: with the fix stashed,
  `scanClaudeProjectsCoverage({})` (the exact call the pre-fix `buildCoverageReport` made) read 269 + 2149 + 1986
  real files off this live host in one call — concrete evidence of the non-hermeticity fix (1) closes. Stress
  test: the exact test-file combination that reproduced the live flake
  (`we:scripts/conveyor/__tests__/run-rating.test.mjs` + `we:scripts/conveyor/__tests__/verify-dispatch.test.mjs`)
  now passes 5/5 in a row.
