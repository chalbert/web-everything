---
bornAs: xo5aobv
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4793-a-load-cap-hold-that-lasts-over-30-minutes-raises-a-health-a.md", "we:scripts/lint-backlog-placeholders.mjs", "we:scripts/__tests__/lint-backlog-placeholders.test.mjs", "we:.githooks/pre-commit", "we:scripts/__tests__/pre-commit-backlog-placeholders.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "ea31c2743948fe56148e2fdc8d39b30f7a21e033"
tags: []
---

# Prevention — constrain load-hold process reporting and reject unfinished new cards

Preserve both prevention obligations from chalbert/web-everything#3360: require basename-only process identities in the load-hold alert contract, and block newly added backlog cards that retain unresolved authoring placeholders at commit time.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3360@63cc14644147dbd2ab7cdac57970df7b0a99ef5a

## Progress

- Original premise/scope: two review requests cited lines 13 and 14 of we:backlog/4793-a-load-cap-hold-that-lasts-over-30-minutes-raises-a-health-a.md, but scope contained only that card. The requests were a basename-only Must line with a sentinel-secret test and a hook or markdown lint rejecting unfinished new cards.
- Corrected premise: commit e94dd20dc prepared that card after its original commit 63cc14644. Its current Design step 3 explicitly permits redacted/truncated commands, and its Test plan mentions redaction rather than omission of every argument. Cite those named sections instead of the stale line references. The goal is not delivered: redaction is weaker than a prohibition on argv.
- Source evidence: we:scripts/operations/host-process-sample.mjs `readProcessSample` reads full command lines and `processSnapshotMetrics` persists redacted command text. This is existing telemetry, not proof of a basename-only load-hold alert. No `loadHoldAlert` occurrence was found in we:scripts/conveyor/tick-core.mjs or we:scripts/conveyor/driver-status.mjs. Runtime alert implementation remains with the original card.
- Source evidence: we:scripts/backlog/scaffold.mjs `renderItem` deliberately emits an unfinished digest, executable acceptance placeholder and `GUARD_RELAXATION_HINT`; we:scripts/backlog/__tests__/scaffold.test.mjs pins that scaffold behavior. we:.githooks/pre-commit currently runs locus lint and staged inventory generation, without a placeholder check. we:scripts/lint-locus-prefix.mjs supplies a staged-file enumeration precedent, but its corpus and purpose differ.
- Corrected scope adds a dedicated staged markdown linter and hook wiring, each with a planned matching test. The original card edit is a contract clarification, not runtime implementation. Scaffold generation remains usable for work in progress; rejection happens when a new card is staged for commit.

## Design

1. Update we:backlog/4793-a-load-cap-hold-that-lasts-over-30-minutes-raises-a-health-a.md consistently across Design, Test plan and Done when: **Must report only executable basename, PID, RSS and CPU% as process details; never report argv, even redacted argv.** Existing duration, measured admission reason, sample availability and derived ownership labels remain alert metadata. Classification may inspect command text transiently, but projected alert rows, notes and durable status must omit it. If executable identity cannot be obtained reliably, report it unavailable rather than falling back to command text. Require a fixture process with an ordinary positional sentinel secret, not merely a credential-shaped flag, and assert its absence from every alert surface. This item changes the contract; the original card owns that runtime test and implementation.
2. Add we:scripts/lint-backlog-placeholders.mjs with a pure body detector and a small staged CLI. Inspect only newly added direct markdown children of we:backlog/ in the index, using NUL-delimited Git enumeration and indexed blobs. Ignore modified existing cards and other files. Never read working-tree text as a substitute for staged content. Git enumeration/blob-read failures must fail the check with a diagnostic.
3. Reject unresolved authoring lines containing the standalone uppercase marker TODO outside fenced code, inline code and quoted examples, and reject the exact unmodified `GUARD_RELAXATION_HINT` imported from we:scripts/backlog/scaffold.mjs. Detect the digest and executable placeholders emitted by `renderItem`; report path, line and reason without modifying files. Historical discussion of the marker in quoted/code examples must remain possible; ordinary prose describing future work without an authoring marker is allowed. Keep the detector specific to unfinished content, not a generic ban on discussing placeholders.
4. Wire the CLI directly into we:.githooks/pre-commit with the existing fail-fast convention. No new package script, dependency or full-corpus sweep is necessary. Preserve the existing hook gates and their exit-code propagation.

## MVP

- Strengthen the original alert card's contract and sentinel-test requirement without changing admission or shared telemetry behavior.
- One staged-only placeholder check, automatically invoked by the existing pre-commit hook, with actionable diagnostics.
- Source/test pairs: we:scripts/lint-backlog-placeholders.mjs → we:scripts/__tests__/lint-backlog-placeholders.test.mjs; we:.githooks/pre-commit → we:scripts/__tests__/pre-commit-backlog-placeholders.test.mjs. Both tests are planned new files. Contract-only edits to the original card require inspection for consistency rather than a new runtime test here.

## Test plan

- In we:scripts/__tests__/lint-backlog-placeholders.test.mjs, cover both actual `renderItem` placeholder variants (with and without a supplied digest), the exact imported hint, unresolved authoring lines, and a complete card. Permit fenced/inline/quoted examples and words merely containing the marker. Pin line-number diagnostics and multiple findings.
- Use temporary Git repositories and staged blobs to prove a new unfinished card fails, a finished card passes, existing-card edits and unrelated files are ignored, and working-tree fixes cannot hide unfinished staged text. Cover the inverse mismatch, spaces in paths, no staged candidates, and Git/read failures. Do not commit test fixtures or touch the user's index.
- In we:scripts/__tests__/pre-commit-backlog-placeholders.test.mjs, execute the real hook with controlled command shims: verify the new linter is invoked, its nonzero exit propagates, later commands do not mask failure, and existing gates still execute on success. This tests hook execution rather than just matching its text.
- Review the original card for any remaining permission to display command arguments, and ensure its future test checks a positional sentinel across planner output, runner persistence and formatted status. Basename-only behavior must not be claimed implemented by this documentation change.

## Proof plan

Run the two new focused Vitest files and the existing we:scripts/backlog/__tests__/scaffold.test.mjs. Demonstrate the staged unfinished-card fixture passing the old hook and being rejected after wiring the guard; demonstrate a completed staged card passing. A missing new test file is not before-proof. Record the fixture outputs and exit codes without making a commit. Inspect the original card diff to show the former redacted-command allowance has been replaced consistently by basename-only reporting and the sentinel assertion. The implementation gate is `npm run check:standards`; the preparation runner owns checks and stamping for this preparation-only change.

## Done when

- The original alert card explicitly forbids argv on every alert surface and specifies a positional-secret regression fixture.
- The focused tests prove that the actual pre-commit path rejects unfinished newly staged cards, accepts complete ones, uses indexed content and preserves existing hook gates.
- Scaffold tests still pass: temporary authoring skeletons can still be generated before authors finish them for commit.

## Follow-ups

- Execute the basename/secret runtime regression as part of the original load-hold implementation, including persisted and rendered output. Do not expand this prevention item into the alert feature itself.
- Broader telemetry command-retention policy, historical-card cleanup, and enforcement for commit paths that bypass local hooks are outside these two review obligations.
