---
bornAs: xh0v9ux
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/probation-launcher.mjs", "we:scripts/lib/__tests__/probation-launcher.test.mjs", "we:scripts/lib/__tests__/dispatch-task-type.test.mjs", "we:scripts/operations/probation-build-run.mjs", "we:scripts/operations/__tests__/probation-build-run.test.mjs", "we:scripts/operations/probation-heal-run.mjs", "we:scripts/operations/__tests__/probation-heal-run.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "e4a038cdc670a63c9b147883faddfc06ba9b266f"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3012's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. Harden the implemented test-fix envelope with one shared diff allowlist that checks every old and new path and file mode. Add adversarial regression cases for a rename into a test path, symlinks, executable bits, and nested fixtures. The original review pointed to the routing proposal in `we:backlog/4551-test-only-fixes-route-to-gemini-flash-codex-checked-for-buil.md`; the remaining guard belongs in the implemented envelope and its build/heal callers.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3012@2592f0973bae4bfccac15cbea13430d15927c3e4

## Progress

- Original premise/scope: the envelope was future work and this card scoped only the #4551 proposal. That card is now resolved. Its former line-14 citation is not an implementation location.
- Corrected premise: `isTestPath` in `we:scripts/lib/dispatch-task-type.mjs:133` already supplies the shared pathname policy to routing and the envelope. `healDiffWithinEnvelope` in `we:scripts/lib/probation-launcher.mjs:309` checks only paths and size; `summarizeNumstat` discards file-mode information. The build adapter in `we:scripts/operations/probation-build-run.mjs:820` already forces `--no-renames`; the heal adapter in `we:scripts/operations/probation-heal-run.mjs:304` additionally uses NUL delimiters. Thus rename endpoint enumeration partly exists; mode enforcement does not.
- Observed probe: a disposable Git repository with one regular test file, passed through the actual summary/envelope helpers, accepted both a mode-only change from 100644 to 100755 (one file, zero LOC) and replacement with a symlink (100644 to 120000, one file, two LOC). Both returned `ok: true` under the test-only envelope. This is remaining work, not already delivered.
- Corrected scope: harden the shared envelope and both production diff adapters, with their existing matching tests. Extend the existing classifier test suite for nested-fixture boundaries; retain the classifier's current policy. `we:scripts/lib/__tests__/probation-launcher.test.mjs:229` already exercises real-Git rename/non-ASCII enumeration through the heal adapter, but does not prove mode rejection. Existing runner coverage lives in `we:scripts/operations/__tests__/probation-build-run.test.mjs` and `we:scripts/operations/__tests__/probation-heal-run.test.mjs`. No routing roster or proposal-card edit is needed.

## Design

Use one shared post-worker change classifier in `we:scripts/lib/probation-launcher.mjs`, invoked by the test-only branch of `healDiffWithinEnvelope`. Reuse `isTestPath` from `we:scripts/lib/dispatch-task-type.mjs` for every pathname; do not introduce another fixture/test regex. Dispatch-time classification remains a prediction; actual Git changes are the envelope's evidence.

Both adapters collect `git diff --raw -z --no-renames <base>` alongside NUL-delimited numstat after their existing intent-to-add/exclusion handling. Raw records provide status, old/new modes, and literal paths; forcing no renames represents a move as deletion plus addition, so both endpoints are checked. This is the mode-bearing equivalent of the originally suggested name-status input; name-status alone cannot detect executable bits or symlinks. Do not combine conflicting rename flags.

Parse raw records without trimming or line-splitting pathnames. The shared classifier accepts only test-policy paths whose present sides have regular non-executable mode 100644; absent sides use 000000 only for additions/deletions. Reject symlinks (120000), executable files (100755), gitlinks, unexpected statuses, malformed/missing metadata, and disagreements between raw changes and numstat paths. A rename from production into tests is rejected on its deleted production endpoint. Ordinary additions, edits, deletions, and moves entirely within allowed regular test files remain eligible under existing size/scope limits.

Pass structured change evidence with the summary into the existing envelope call in `we:scripts/operations/probation-build-run.mjs` and `we:scripts/operations/probation-heal-run.mjs`. Apply the same exclusions to both evidence streams. Preserve existing card-tamper, scope, hook, checker, and size checks. Boundary refusals retain the `test-fix refused` reason prefix so the build caller cannot mistake them for size overflow and route them as ordinary oversized work. Other task envelopes do not require test-only metadata.

## MVP

1. Add the raw-record parser and shared change classifier to `we:scripts/lib/probation-launcher.mjs`; require complete evidence for test-only admission and retain numstat for LOC limits.
2. Wire mode-bearing evidence into both runners. Switch build numstat capture to NUL delimiters as already supported by its parser. Capture from the same base and prepared worktree state as the current summary, including worker-created files and existing exclusions.
3. Extend the three matching envelope/runner test suites plus `we:scripts/lib/__tests__/dispatch-task-type.test.mjs`. Keep the existing test-path policy, provider roster, LOC/file caps, and fallback behavior.

## Test plan

- In `we:scripts/lib/__tests__/probation-launcher.test.mjs`, add a table covering regular test add/edit/delete, all-test moves, production-to-test and test-to-production moves, symlink additions/replacements/deletions, executable additions and bit-only changes, gitlinks, malformed/truncated records, absent metadata, and raw/numstat path mismatches. Exercise spaces, tabs, newlines, and non-ASCII names to prove NUL parsing.
- In `we:scripts/lib/__tests__/dispatch-task-type.test.mjs`, table-test nested fixtures under accepted test directories and fixture namespaces, plus lookalike production directories and traversal rejection. Use the same cases when checking post-worker admission to expose policy drift.
- In `we:scripts/operations/__tests__/probation-build-run.test.mjs` and `we:scripts/operations/__tests__/probation-heal-run.test.mjs`, exercise actual Git adapters in disposable repositories, with rename detection configured on, worker-created files, and preexisting exclusions. Assert both old/new paths reach the guard and mode-only changes cannot disappear as empty diffs.
- Runner cases must show an allowed regular test edit still reaches the checker/success path, while each boundary violation is refused before checker, commit, push, or PR operations. Spy on those effects; do not use a live remote. Keep non-test task and oversized-test regressions green.

## Proof plan

Run the focused suite with `npx vitest run` targeting `we:scripts/lib/__tests__/probation-launcher.test.mjs`, `we:scripts/lib/__tests__/dispatch-task-type.test.mjs`, `we:scripts/operations/__tests__/probation-build-run.test.mjs`, and `we:scripts/operations/__tests__/probation-heal-run.test.mjs` (strip the repository prefix when supplying local CLI arguments). Record the new executable-bit/symlink cases failing against the old code and passing after implementation.

Repeat the disposable-Git probe from Progress through each production adapter and the shared envelope. Retain raw diff evidence and verdicts: a regular nested fixture passes; a production-to-test move, test-named symlink, and executable-bit-only change each fail. These probes run locally without model dispatch or remote writes. Run `npm run check:standards` and record its result separately from focused test results.

## Done when

1. The focused tests in Proof plan pass, with demonstrated before/after failure for the missing mode guard.
2. Both runners consume the same fail-closed classifier and mode-bearing Git evidence; every changed endpoint is checked against the existing test-path policy.
3. Real-Git adversarial probes demonstrate refusal before delivery effects, and ordinary regular test edits retain their existing route.

## Follow-ups

No new policy decision is required for this guard. Supplying structured failing-file evidence to CI-heal dispatch remains the follow-up already described in `we:backlog/4551-test-only-fixes-route-to-gemini-flash-codex-checked-for-buil.md`; it is not a dependency for validating actual worker diffs. Changes to fixture eligibility or routing models would be separate work, not part of this prevention item.
