---
bornAs: xtbaswi
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/prepare-stamp-land.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:scripts/conveyor/prepare-result.mjs", "we:scripts/operations/__tests__/prepare-stamp-land.test.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs", "we:scripts/conveyor/__tests__/prepare-result.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "8e5fb6fb4f2f1f8c0820e715522eb3e236efa0ad"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3046's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

The six owed guards concern preparation status rejection, live-worker capacity under an unrelated hold, detached-spawn and worker termination behavior, the PR-head trust boundary, empty fenced sections, and verifying the committed stamp. Current implementation locations and the corrected scope are recorded below.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3046@39beb43707d40ecb22c516f67bdceed582f7e84e

## Progress

Preparation research on 2026-10-02; no stamp applied.

- **Original premise/scope:** six prevention requests cited historical line numbers in three implementation files and assumed three existing matching test files. The retry wording implied a failed worker would simply be retried.
- **Corrected premise/scope:** retain the three source files and their matching test paths; explicitly plan the currently missing `we:scripts/conveyor/__tests__/prepare-result.test.mjs`. Shape tests currently live in `we:scripts/operations/__tests__/prepare-stamp-land.test.mjs` under `prepare result shape`; move those tests to the matching result suite and extend them. The work remains partly behavioral fixes and partly missing regression coverage, not already delivered.
- **Source evidence:** `we:scripts/operations/prepare-stamp-land.mjs` in `landPrepareStamp` currently uses name-only diff output, accepts an empty diff, and checks only that every reported path is the card. Its status predicate accepts only open cards; its committed-HEAD stamp check already exists but lacks the requested filesystem-versus-HEAD regression. Its CLI success releases the route; failure writes a terminal record, sets exit code 1, and retains the route.
- **Source evidence:** `we:skills-src/conveyor/build-dispatch-daemon.mjs` in `runTimedBuildDispatchTick` preserves live rows during reconciliation, then unconditionally deletes held numbers from `prepareBusy` before assigning `prepare.inFlight`. In `cliStampPrepare`, a spawn failure releases the reservation and rethrows. Terminal recovery failures require an allowed transient retry or an explicit release; elapsed lease time alone is not permission to retry. Existing tests in `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs` cover lease serialization, terminal failure gating and successful spawn deduplication, but the detached wiring block lacks spawn-error coverage.
- **Observed probe:** importing `prepareCardStatus` from `we:scripts/conveyor/prepare-result.mjs` and supplying an empty fenced Design section plus three populated required sections returned `hasSections: true`. `readSections` appends the opening fence as content. This directly reproduces one outstanding defect. Symbol references replace the obsolete file:line citations.

## Design

Preserve the existing recovery policy and close the six review gaps within the declared sources and tests:

1. In `we:scripts/operations/prepare-stamp-land.mjs`, retain the explicit rejection of a `status: preparing` card. Add a regression proving the worker reports the existing not-open reason and releases its lane without stamping or opening a PR. The review allows rejection with an explicit reason; expanding eligible statuses is unnecessary.
2. In `we:skills-src/conveyor/build-dispatch-daemon.mjs`, distinguish hold-based launch exclusion from actual occupied capacity. A live prepare row still consumes a prepare slot even when the same number has a non-prepare hold. Retain the hold and prevent duplicate dispatch; exclude held entries from busy accounting only when they do not represent a live worker. Preserve the existing two-slot cap.
3. Pin `cliStampPrepare` spawn failure behavior and the CLI outcome handling in `we:scripts/operations/prepare-stamp-land.mjs`: success/already-stamped releases the route; failure emits the terminal JSON record, reports an error, exits unsuccessfully, and retains the route for the current failure policy. If needed, extract a small injectable CLI runner in the same source so tests exercise the real handler without launching production work. Do not introduce automatic retry on terminal failure.
4. Before checking out a PR head in `we:scripts/operations/prepare-stamp-land.mjs`, inspect NUL-delimited raw diff output with rename detection disabled. Require exactly one entry, status `M`, the exact card path, and regular non-executable mode `100644` on both sides. Reject empty diffs, adds, deletes, renames, copies, type/mode changes, symlinks and extra paths before any PR-head script runs. Keep the fetched-SHA equality check. Parse Git metadata, not human-formatted whitespace-separated filenames.
5. In `we:scripts/conveyor/prepare-result.mjs`, fence delimiters and language tags alone are not section content. Preserve populated fenced commands and exclusion of headings inside fences. Blank or whitespace-only fence bodies fail the required-section check.
6. Keep the committed-HEAD stamp check in `we:scripts/operations/prepare-stamp-land.mjs`; independently model filesystem and git-show data in tests so a successful filesystem stamp cannot mask an unstamped commit.

## MVP

One implementation change set covering the six guards, with no new service or policy file. Update the worker trust-boundary check, held/live capacity accounting, and fence-content counting; add the missing tests and only the minimal CLI test seam needed. Move the existing shape describe block into planned `we:scripts/conveyor/__tests__/prepare-result.test.mjs` rather than duplicating it. Existing scope already pairs each of the three source entries with its existing or planned test file. No API/spec entity or website changes are required.

## Test plan

- `we:scripts/operations/__tests__/prepare-stamp-land.test.mjs`: preparing status with all sections rejects explicitly; lane releases exactly once and stamp/open-pr never run. Independently stamped filesystem and unstamped HEAD rejects before verification/open-pr and releases the lane. Test successful and already-stamped CLI outcomes versus a failed outcome, asserting route-release calls, terminal JSON, error reporting and exit status through the actual CLI handler.
- The same worker suite must exercise a temporary Git repository for the trust boundary: ordinary card modification passes; empty diff, rename into/out of the card, symlink replacement, executable mode, add/delete and an additional changed file reject before checkout/script execution. Use injected effects for acquisition and publishing so no real remote, credentials, commits in this checkout or PRs are involved. Retain existing positive recovery coverage.
- `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs`: one live prepare row plus an unrelated hold remains in `prepare.inFlight`; with a second occupied slot and further candidates, no third prepare launches. Hold remains and the live row is not settled or redispatched. Add detached spawner throw, asynchronous error event, and missing-pid cases; each releases its reserved route once and propagates the error. Retain success/pending and terminal-failure policy tests.
- Planned `we:scripts/conveyor/__tests__/prepare-result.test.mjs`: empty and whitespace-only backtick/tilde fences, with/without language tags, fail when they are the sole content of each required section. Populated fenced commands and prose pass. Preserve indented/long closing fence, comment and fenced-heading regressions moved from the worker suite.

## Proof plan

During implementation, run the three scope test suites with Vitest from the WE checkout, passing the repository-relative portions of `we:scripts/operations/__tests__/prepare-stamp-land.test.mjs`, `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs`, and `we:scripts/conveyor/__tests__/prepare-result.test.mjs` as arguments. Capture red results for the new empty-fence, PR metadata and held/live capacity cases before their fixes, followed by green results after. Existing correct status/HEAD/route behavior is proved by new passing regression assertions, not claimed as a newly repaired defect.

Use the disposable Git fixture to show the actual raw diff records and rejection ordering, and the injected CLI/spawn tests to show exit/release outcomes without any production dispatch. Run `npm run check:standards` as the final implementation gate. Preparation itself has only performed source inspection and the read-only empty-fence probe; implementation tests and gates remain for the implementation/runner stages.

## Follow-ups

A shared exact-single-path PR trust-boundary helper remains a separate follow-up once other callers are audited; do not widen this change to every daemon route. Keep retry policy unchanged and name the tests beside any retry/release comments touched. No unresolved design choice is needed for these six guards.

## Done when

All six guards have named deterministic tests, the three targeted suites and standards gate pass, invalid PR trees are rejected before execution, live held workers still consume capacity, and empty fenced sections no longer qualify as completed preparation. Preserve the independent-review idempotency key above.
