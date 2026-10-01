---
bornAs: xpsuizi
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/model-probation.mjs", "we:scripts/lib/__tests__/model-probation-trials.test.mjs", "we:scripts/conveyor/run-scorecard-store.mjs", "we:scripts/conveyor/__tests__/run-scorecard-store.test.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-30"
preparedAgainstSha: "74f3c74136d4605aedca5b439e1d05571cac736f"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2849's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/model-probation.mjs:338` — Add a `lookupPr` contract that returns the review-label timestamp, and require the verdict to postdate the launch's `scoredAt`. Cover it with a test.
2. `we:scripts/lib/model-probation.mjs:503` — Extract the `judge` command into an exported `runJudge({lookupPr, io, dryRun})` and test it. Have the sweep re-read the store under the append lock before writing. Report the count of failed lookups, distinct from the count still awaiting a verdict.
3. `we:scripts/lib/model-probation.mjs:595` — In lookupPr, treat `files.length >= 100` (or a `changedFiles` count from gh mismatching the list) as unknown scope and omit `filesTouched`, so the existing fail-closed path applies. Add a test for it.
4. `we:scripts/lib/model-probation.mjs:338` — Require the `review:accepted` label (or the review-verdict record) before stamping `independent-claude` on a `landed` row. Otherwise use a non-counted verifier value. Add a test that a merged PR with no review label is not counted as verified.
5. `we:scripts/lib/model-probation.mjs:344` — Add a deterministic regression test for rejected and reworked trials with missing scope and omitted evaluator, including through judgePendingTrials; require the evaluator or default to the real classifier.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2849@02c8e95a475a1b652e7db73114386ca5bbc57479

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/model-probation-trials.test.mjs we:scripts/conveyor/__tests__/run-scorecard-store.test.mjs` (drop the `we:` prefixes when typing it) fails before this item lands (the new cases for guards 1–5 are red) and passes after.

## Progress

- 2026-09-30 prepare pass. **Premise check:** not delivered. `git log` for `4439`/`4439` shows only the JIT renumber commit; `judgedTrialRow`, `judgePendingTrials` and the inline `judge` CLI still have every gap below on `origin/main` (74f3c7413).
- **Citation drift corrected** (goal unchanged): the card's `:338/:344/:503/:595` refer to an older file. Today `we:scripts/lib/model-probation.mjs` is 531 lines: `trialOutcomeFromPr` is `:328`, `judgedTrialRow` `:346`, `judgePendingTrials` `:387`, the `judge` CLI `:503-521` with the inline `gh pr view` lookup at `:510` (no `:595` exists; guard 3 belongs at `:510`/`:395`).
- **Scope corrected:** old `scope:` named `we:scripts/lib/__tests__/model-probation.test.mjs`, which holds only registry tests. The trial tests live in `we:scripts/lib/__tests__/model-probation-trials.test.mjs`. Guard 2's "under the append lock" also needs a small helper in `we:scripts/conveyor/run-scorecard-store.mjs` (its `appendScorecard` at `:331` already holds the lock), so that file and its test join the scope.

## Design

The judge sweep (`judgePendingTrials`, `we:scripts/lib/model-probation.mjs:387`) turns a launch row into a counted `independent-claude` trial from a bare `gh pr view` snapshot. Five gaps let a wrong or unreviewed row count as verified evidence. Fix all five in the pure module plus one store helper; no registry writes.

1. **Verdict must postdate the launch.** The `lookupPr` contract (documented at `:379-386`) grows a `reviewLabelAt` field: the ISO time the `review:accepted`/`review:changes` label was last applied. `gh pr view --json labels` has no timestamps, so the CLI lookup adds one `gh api repos/<repo>/issues/<pr>/events` call and takes the newest `labeled` event for the verdict label. `trialOutcomeFromPr` (`:328`) gains a `launchScoredAt` option: a label verdict with `reviewLabelAt` missing or `<= launch.scoredAt` returns `null` (stays pending), so a stale label from before the launch never judges it. Merge/close outcomes are unaffected by this rule. `trialOutcomeFromPr` called without `launchScoredAt` keeps today's behaviour (only the sweep is strict). Ordering assumption, stated: the launch row is scored when the PR is opened, before any review; a `review:changes` label applied earlier (e.g. re-armed) stays pending until a fresh label event — fail closed, never a guessed verdict. `reviewLabelAt` comes from `gh api --paginate repos/{owner}/{repo}/issues/<pr>/events` (the `{owner}/{repo}` placeholder, or `launch.repo` when set), newest `labeled` event whose label is still on the PR; a failed events call counts as `failed`, not pending.
2. **`runJudge` extraction.** Move the CLI body (`:503-521`) into exported `runJudge({ lookupPr, io, dryRun, log })` returning `{ judged, pending, failed }`. `judgePendingTrials` counts a lookup that throws (`:392`) into `failed`, separate from `pending` (lookup ok, no verdict yet). The CLI prints `N judged, M awaiting a verdict, K lookups failed`. The append goes through a new `appendScorecardUnlessJudged(row, io)` in `we:scripts/conveyor/run-scorecard-store.mjs` that, inside the existing lock and its re-read, skips the append if a trial row with the same `launchKey` already exists (two concurrent sweeps can no longer double-count). It returns `null` when it skipped; `judgePendingTrials` then does not push into `judged` (counted `skipped`). It covers the locked (file) path only; the injected in-memory `io.write` branch (`:344`) is unlocked and not claimed. A `lookupPr` that returns `null` counts as `failed`.
3. **Truncated file list = unknown scope.** `gh pr view --json files` caps at 100. In the CLI lookup, add `changedFiles` (count) to the JSON fields; in `judgePendingTrials` (`:395`) treat `files.length >= 100` or `changedFiles !== files.length` as unknown scope: pass `null`, so `judgedTrialRow` omits `filesTouched` (`:371`) and `isCriticalMiss` fails closed.
4. **Verified only with a review verdict.** In `judgedTrialRow` (`:362`), a `landed` row without `review:accepted` on the PR (or a verdict record) gets `verifiedBy: 'unreviewed-merge'`, which is not in `COUNTED_VERIFIERS` (`:267`), so `graduationProgress` does not count it. `rejected`/`reworked` come from a review or a human close and keep `independent-claude`. Input: `judgedTrialRow` takes `reviewed` (default `false`). Because a written `unreviewed-merge` row would mark the launch judged forever (`judgedLaunchKeys` `:303` keys only on `launchKey`), the SWEEP does not write one: a merged PR without `review:accepted` stays pending (`null`) until the label lands, then is judged `landed` + `independent-claude`. The `unreviewed-merge` value is the defense for any direct `judgedTrialRow` caller that omits `reviewed`. `judgePendingTrials` passes `reviewed: labels.includes('review:accepted')`.
5. **No fail-open default evaluator.** `judgedTrialRow` defaults `isCriticalMiss = () => false` (`:346`), so an omitted evaluator marks a scope-less rejected/reworked trial as a non-critical miss. Make the evaluator required (throw a `TypeError` if absent) in `judgedTrialRow` and default `judgePendingTrials` to the real `isCriticalMiss` from `we:scripts/lib/critical-work.mjs` (imported at the top; no cycle: it does not import this module).

## MVP

Musts only: the five guards above, each with its test; `runJudge` export; the `appendScorecardUnlessJudged` helper; `check:standards` green.

Out of scope (see Follow-ups): running the sweep on a schedule, re-judging already-written rows, back-filling `reviewLabelAt` for existing trials, changing `GRADUATION_NUMBERS`.

## Test plan

All in `we:scripts/lib/__tests__/model-probation-trials.test.mjs` unless noted; each is RED today because the behavior does not exist.

- **stale verdict label** — a `review:changes` PR whose `reviewLabelAt` is before the launch `scoredAt` stays pending; after it, judged `reworked`. Red: today the label alone judges it.
- **missing `reviewLabelAt`** — label verdict without a timestamp stays pending (fail closed).
- **`runJudge`** — dry run writes nothing; a real run appends once; a throwing lookup is counted in `failed`, not `pending`. Red: `runJudge` is not exported.
- **concurrent sweep** (`we:scripts/conveyor/__tests__/run-scorecard-store.test.mjs`) — `appendScorecardUnlessJudged` called twice for the same launch keeps one row. Red: helper absent.
- **truncated files** — 100 files, and `changedFiles: 130` with 100 listed, both omit `filesTouched` and give `criticalMiss: true`. Red: both are judged on a partial list today.
- **merged, no review label** — the sweep leaves a `MERGED` PR without `review:accepted` pending (no row, `verified: 0`), then judges it `landed` once the label lands; direct `judgedTrialRow(..., {outcome:'landed'})` without `reviewed` gives `verifiedBy: 'unreviewed-merge'`, which `graduationProgress` does not count. Red: counted as verified today.
- **existing tests rewritten (planned edits)** in the same file: the `judgedTrialRow` case (`:54-61`) passes an evaluator and `reviewed: true`; the store-backed sweep fixtures (`:70-88`) gain `reviewLabelAt` after the launch `scoredAt` and `review:accepted` on PR 101; the `trialOutcomeFromPr` table (`:19-30`) stays as is (no `launchScoredAt`).
- **omitted evaluator** — `judgedTrialRow(..., {outcome:'rejected'})` throws; through `judgePendingTrials` with no evaluator, a scope-less rejected and a scope-less reworked trial both get `criticalMiss: true`. Red: both are `false` today.

## Proof plan

- Before/after on the real CLI, deterministic: seed a temp store (`--store=<tmp>` inside the lane) with one `probation-launch` row, and put a stub `gh` first on `PATH` that answers `pr view` with a MERGED PR carrying no `review:accepted` label. Run `node we:scripts/lib/model-probation.mjs judge --dry-run --store=<tmp>` (drop the `we:` prefix when typing) before and after the change and paste both outputs: before, `PR #… landed` (would be counted); after, `0 judged, 1 awaiting a verdict, 0 lookups failed`. Make the stub `gh` exit 1 for a second launch to show the `failed` count. Delete the stub and temp store afterwards.
- Run the focused vitest command from Done-when red on the pre-change tree (new cases fail) and green after.
- `npm run check:standards` green.

## Follow-ups

- Schedule the `judge` sweep (daemon tick) instead of manual runs.
- Back-fill `reviewLabelAt` / re-verify trial rows written before this change.
- Paginate the PR file list (`gh api .../files`) so large PRs get real scope instead of unknown scope.
