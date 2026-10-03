---
kind: story
size: 5
parent: "x0hvbwx"
status: open
blockedBy: ["xcs4nce"]
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/merge-ai-prs.test.mjs", "we:scripts/__tests__/merge-ai-prs-recheck-main-moved.test.mjs", "we:scripts/lib/tested-main-base.mjs", "we:scripts/lib/__tests__/tested-main-base.test.mjs", "we:.github/workflows/ci.yml"]
dateOpened: "2026-10-03"
preparedDate: "2026-10-03"
preparedAgainstSha: "838e849ab8b35fa4b94216b7d474b3138d979ba5"
tags: [policy, drain, merge, freshness]
---

# Re-check a green PR before merge when main moved after its checks ran

Before merging, the drain checks whether main moved after the PR's green `test` run started. If it did, the
drain rebuilds the PR onto current main so CI runs again, and merges on a later pass. Governed by
`mergeGate.recheckWhenMainMoved` (default `if-older-than-N-min`, operator ruling 2026-10-03) and
`mergeGate.recheckMaxAgeMin` (default 30).

## Progress

Prepared 2026-10-03 against `838e849ab`.

| Premise | Checked against the code |
| --- | --- |
| The drain merges without re-testing against the newest main. | Confirmed. `classifyPr` (`we:scripts/merge-ai-prs.mjs:711-751`) needs `test` green and the state `CLEAN` or `UNSTABLE`. `revalidateForMerge` (`:785-797`) only pins the head SHA. The merge at `:5487-5493` uses `--match-head-commit`. Nothing compares main's tip. The serial loop (`:5253`, `:5294`) merges one PR after another in the same pass. |
| GitHub would report the PR as `BEHIND`. | **No.** Main's branch protection has `strict: false` (read with `gh api repos/chalbert/web-everything/branches/main/protection/required_status_checks`, 2026-10-03). So a PR whose green run predates the last merge still reads `CLEAN`. The `BEHIND` skip at `:745` never fires. |
| A plain CI re-run would re-check. | **No.** A re-run reuses the run's original merge commit, so it tests the old main again. The PR head must move. The rebuild plumbing already exists: `rebaseDropManifest` (`we:scripts/lib/rebase-drop-manifest.mjs`), used by the drain at `we:scripts/merge-ai-prs.mjs:4459-4560`. |

Related, not a duplicate: card #2824 refreshes review-held `BEHIND` PRs. This story is about ready, green PRs.

## Design

1. **Tested main revision, by commit identity, not by clock.** A run's start time does not say which main it
   tested: a rerun reuses the run's original merge commit, and a queued run can start after the main it
   merged against went stale. So "which main did this run test" is the **first parent of the merge commit the
   run checked out**. Add a one-line step to `we:.github/workflows/ci.yml`, right after checkout, that records
   `git rev-parse HEAD^1` as the run's tested main SHA (a check-run annotation or job output the drain can
   read through the API; the builder picks the one the existing `isRequiredCheckGreen` read already reaches).
   Shared helpers live in `we:scripts/lib/tested-main-base.mjs`, which the main-red story (#xca0u65) also
   uses: `readTestedMainSha(run)` and `mainMovedSince(testedMainSha, mainTip)`. A run with no recorded tested
   SHA (an older run) counts as "moved", the safe direction.
2. **What counts as "main moved".** `mainMovedSince` walks main's first-parent commits in
   `testedMainSha..mainTip`. Main moved when **any** of them is not a drain bookkeeping commit. Drain
   bookkeeping commits (the JIT-numbering commit and the resolve-on-land commit, which land minutes after each
   merge: 469-1029 s, per the #3383 note in `we:scripts/check-standards-rules.mjs`) are recognised by the
   exact subject prefix and author the drain writes; the builder reads both from `we:scripts/lane-drain.mjs`
   and `we:scripts/merge-ai-prs.mjs` and pins them in one exported constant. Without this exclusion, merge A's
   own bookkeeping commit lands during B's rebuilt CI run, B reads as stale again, and the queue stalls.
3. **Pure predicate** `needsMainMovedRecheck({ policy, moved, runStartedAt, recheckCount, now })`:
   - `if-older-than-N-min` (default): re-check only when main moved **and** the PR's last green run started
     more than `recheckMaxAgeMin` (30) minutes ago.
   - `always`: re-check whenever main moved (per step 2).
   - `off`: never re-check (today's behaviour).
   - **Bounded.** A PR already re-checked `RECHECK_MAX_PER_PR` times (module constant, 2) in the last 6 hours
     (counted from `recheck-main-moved` events in the policy journal, subject `<repo>#<pr>`) is **not**
     re-checked again: it proceeds as `off` would, and the drain records one `recheck-cap-reached` event. So a
     busy main can delay a PR by at most two CI cycles, never stall it indefinitely.
4. **Where.** Read the run from the same latest run that `isRequiredCheckGreen` selects
   (`we:scripts/merge-ai-prs.mjs:356-469`). Apply the predicate in the per-PR revalidation just before the
   merge. Re-read main's tip after every merge in the serial loop, so the second PR of a pass sees the first
   PR's merge.
5. **Action.** On a re-check, skip with reason `recheck-main-moved`, record a `recheck-main-moved` event, and
   rebuild the PR onto `origin/main` with `rebaseDropManifest` (falling back to `rebaseDropContent`, as the
   existing path does). That pushes a new head, CI runs on it, and a later pass merges it when green.
   - A real conflict stays skipped for the conflict-fix path.
   - Never touch a `review:*` label or the `ready-to-merge` label.
   - In dry-run mode, print `would re-check` and push nothing.
6. **Kill switch.** The policy value `off` is the kill switch. No new CLI flag.

The engine-tier trust chain covers `we:scripts/merge-ai-prs.mjs` (`we:scripts/lib/gate-config.mjs`), so this
PR escalates to the review committee, as expected.

## MVP

Steps 1 to 5.

## Test plan

- **Capability (RED today, fails before this lands):** `we:scripts/__tests__/merge-ai-prs-recheck-main-moved.test.mjs`:
  - The predicate, per value: `always` re-checks on any move; `off` never; `if-older-than-N-min` with N = 30
    merges a 10-minute-old run and re-checks a 45-minute-old one. A main that did not move never re-checks.
  - **Bookkeeping only:** main's only new commits since the tested SHA are drain bookkeeping commits (a
    JIT-numbering commit, a resolve-on-land commit): no re-check. One real commit among them: re-check.
  - **Commit identity, not clock:** a run rerun after main moved (new `startedAt`, old tested SHA) is
    re-checked. A run queued and started late, but whose tested SHA equals main's tip, is not.
  - **Bounded:** a PR already re-checked twice in the window is not re-checked a third time; one
    `recheck-cap-reached` event is recorded. After the window the count resets.
  - A run with no recorded tested SHA counts as moved.
  - Default (no config): behaves as `if-older-than-N-min` with 30.
  - A bad `recheckMaxAgeMin` falls back to 30, through the loader.
  - **Replay of failure mode (2):** PRs A and B are both green against main M0, B's green run started more
    than 30 minutes ago. The pass merges A (main moves to M1). Before this story: B merges untested against
    M1. After it, under the default: B is skipped with `recheck-main-moved`, and `rebaseDropManifest` is
    called with B's head ref. With B's run only 10 minutes old, the default merges B (fresh CI is trusted).
    Under `always`, B is re-checked either way. Under `off`: B merges (the old behaviour is still selectable).
  - The rebuild never edits a `review:*` label or the `ready-to-merge` label. Dry-run pushes nothing.

## Proof plan

1. Before/after on the live queue: run the drain in dry-run JSON mode on current open PRs, with at least two
   ready PRs. **Before:** both shown as `merge`. **After:** the second shown as `would re-check`, naming
   main's tip and the run's `startedAt`.
2. On the next real drain pass with two or more ready PRs: show the second PR's rebuilt head, its new CI run,
   and its later merge (PR numbers and run ids in the PR description or a follow-up comment).

## Follow-ups

- Throughput: under `always`, a pass merges at most one PR per CI cycle (bookkeeping commits no longer count
  as a move, and a PR is re-checked at most twice, so the queue cannot stall). The default
  `if-older-than-N-min` trusts a run younger than 30 minutes. Batching (test several PRs merged together)
  would be a separate story.

## Done when

1. **Executable:** the replay case fails before this lands (B merges) and passes after (B is re-checked).
2. Proof step 1 is pasted in the PR.
