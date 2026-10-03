---
kind: story
size: 5
parent: "x0hvbwx"
status: open
blockedBy: ["xcs4nce"]
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/merge-ai-prs.test.mjs", "we:scripts/__tests__/merge-ai-prs-recheck-main-moved.test.mjs"]
dateOpened: "2026-10-03"
preparedDate: "2026-10-03"
preparedAgainstSha: "838e849ab8b35fa4b94216b7d474b3138d979ba5"
tags: [policy, drain, merge, freshness]
---

# Re-check a green PR before merge when main moved after its checks ran

Before merging, the drain checks whether main moved after the PR's green `test` run started. If it did, the
drain rebuilds the PR onto current main so CI runs again, and merges on a later pass. Governed by
`mergeGate.recheckWhenMainMoved` (default `always`) and `mergeGate.recheckMaxAgeMin` (default 30).

## Progress

Prepared 2026-10-03 against `838e849ab`.

| Premise | Checked against the code |
| --- | --- |
| The drain merges without re-testing against the newest main. | Confirmed. `classifyPr` (`we:scripts/merge-ai-prs.mjs:711-751`) needs `test` green and the state `CLEAN` or `UNSTABLE`. `revalidateForMerge` (`:785-797`) only pins the head SHA. The merge at `:5487-5493` uses `--match-head-commit`. Nothing compares main's tip. The serial loop (`:5253`, `:5294`) merges one PR after another in the same pass. |
| GitHub would report the PR as `BEHIND`. | **No.** Main's branch protection has `strict: false` (read with `gh api repos/chalbert/web-everything/branches/main/protection/required_status_checks`, 2026-10-03). So a PR whose green run predates the last merge still reads `CLEAN`. The `BEHIND` skip at `:745` never fires. |
| A plain CI re-run would re-check. | **No.** A re-run reuses the run's original merge commit, so it tests the old main again. The PR head must move. The rebuild plumbing already exists: `rebaseDropManifest` (`we:scripts/lib/rebase-drop-manifest.mjs`), used by the drain at `we:scripts/merge-ai-prs.mjs:4459-4560`. |

Related, not a duplicate: card #2824 refreshes review-held `BEHIND` PRs. This story is about ready, green PRs.

## Design

1. **Pure predicate** `needsMainMovedRecheck({ policy, checkStartedAt, mainTipCommittedAt, now })`:
   - "Main moved" means main's tip commit time (first-parent) is later than the `startedAt` of the PR's latest
     required `test` run. PR CI computes the merge ref when the run starts.
   - `always` (default): re-check whenever main moved.
   - `if-older-than-N-min`: re-check only when main moved **and** the run started more than
     `recheckMaxAgeMin` minutes ago.
   - `off`: never re-check (today's behaviour).
2. **Where.** Read `startedAt` from the same latest run that `isRequiredCheckGreen` selects
   (`we:scripts/merge-ai-prs.mjs:356-469`). Apply the predicate in the per-PR revalidation just before the
   merge. Re-read main's tip after every merge in the serial loop, so the second PR of a pass sees the first
   PR's merge.
3. **Action.** On a re-check, skip with reason `recheck-main-moved` and rebuild the PR onto `origin/main`
   with `rebaseDropManifest` (falling back to `rebaseDropContent`, as the existing path does). That pushes a
   new head, CI runs on it, and a later pass merges it when green.
   - A real conflict stays skipped for the conflict-fix path.
   - Never touch a `review:*` label or the `ready-to-merge` label.
   - In dry-run mode, print `would re-check` and push nothing.
4. **Kill switch.** The policy value `off` is the kill switch. No new CLI flag.

The engine-tier trust chain covers `we:scripts/merge-ai-prs.mjs` (`we:scripts/lib/gate-config.mjs`), so this
PR escalates to the review committee, as expected.

## MVP

Steps 1 to 3.

## Test plan

- **Capability (RED today, fails before this lands):** `we:scripts/__tests__/merge-ai-prs-recheck-main-moved.test.mjs`:
  - The predicate, per value: `always` re-checks on any move; `off` never; `if-older-than-N-min` with N = 30
    merges a 10-minute-old run and re-checks a 45-minute-old one. A main that did not move never re-checks.
  - Default (no config): behaves as `always`.
  - A bad `recheckMaxAgeMin` falls back to 30, through the loader.
  - **Replay of failure mode (2):** PRs A and B are both green against main M0. The pass merges A (main moves
    to M1). Before this story: B merges untested against M1. After it, under the default: B is skipped with
    `recheck-main-moved`, and `rebaseDropManifest` is called with B's head ref. Under `off`: B merges (the old
    behaviour is still selectable).
  - The rebuild never edits a `review:*` label or the `ready-to-merge` label. Dry-run pushes nothing.

## Proof plan

1. Before/after on the live queue: run the drain in dry-run JSON mode on current open PRs, with at least two
   ready PRs. **Before:** both shown as `merge`. **After:** the second shown as `would re-check`, naming
   main's tip and the run's `startedAt`.
2. On the next real drain pass with two or more ready PRs: show the second PR's rebuilt head, its new CI run,
   and its later merge (PR numbers and run ids in the PR description or a follow-up comment).

## Follow-ups

- Throughput: under `always`, a pass merges at most one PR per CI cycle. If that hurts, the operator can
  switch to `if-older-than-N-min`. Batching (test several PRs merged together) would be a separate story.

## Done when

1. **Executable:** the replay case fails before this lands (B merges) and passes after (B is re-checked).
2. Proof step 1 is pasted in the PR.
