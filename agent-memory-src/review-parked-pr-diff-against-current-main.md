---
name: review-parked-pr-diff-against-current-main
description: "A parked PR's `gh pr diff` is against its stale merge-base — diff the head against CURRENT main to find the true review surface; sibling PRs may have already landed most of it, and a gate-self touch can be illusory. `gh pr view`'s changedFiles/additions/deletions are stale the same way and routinely over-report — measure locally."
metadata:
  node_type: memory
  type: feedback
---

When reviewing a parked PR (`/review`), do NOT judge off `gh pr diff` alone — it renders the PR against its **stale merge-base**, so in a heavily-parallel constellation (lanes + drain, siblings landing continuously) it can show code that has **already landed on main** via other PRs. Fetch the PR head and diff it against **current** `origin/main` (`git diff origin/main..<head>`) to get the true review surface.

This is not cosmetic — it changes a **correctness** judgment. The stale diff misclassifies **gate-self**: a PR whose raw diff "touches" `scripts/merge-ai-prs.mjs` / the review trust chain can, against current main, touch **none of it** (that code already merged via a sibling), so the gate-self / `humanRequired` alarm is illusory. Review the net diff, not the raw one.

**Why:** the drain parks a PR by size/blast-radius against its merge-base; by the time a human reviews it, sibling lanes for the same epic have often landed the overlapping code. Judging the raw `gh pr diff` inflates the surface and can escalate a data-only change as a trust-chain edit. **How to apply:** in `/review`, after `gh pr view`/`gh pr diff`, always `git fetch origin <headRef>` then `git diff origin/main..FETCH_HEAD --stat` — review THAT. Worked example: WE PR #798 — raw diff showed merge-ai-prs.mjs / tick-core.mjs / readiness / ci.yml; net vs current main was 21 backlog data files only (the code had landed via #797/#799/#800). Same family as [[verify-before-you-claim]] and [[humangate-review-is-not-real-escalation]] — verify against live state, not the label; distinct axis is **the review SURFACE itself is stale in the raw PR diff**.

## The COUNTS are stale too — `gh pr view` routinely over-reports (measured 2026-08-09)

Same root cause, different symptom, and the one that wastes the most time because a number looks like a fact.
`gh pr view <N> --json changedFiles,additions,deletions` is served from GitHub's own base for the PR, which
lags what the branch actually contributes once main advances or another lane's work is merged into the branch.
Never quote those figures as the PR's size. Seven merged `chalbert/web-everything` PRs, each reconstructed at
its own merge time (`mainBefore = <mergeCommit>^1`, `head = <mergeCommit>^2`, then
`git diff $(git merge-base mainBefore head) head --numstat`):

| PR | `gh pr view` | real, at merge time |
|---|---|---|
| #1135 | 25 files, +3333/-79 | **15 files, +2635/-1** |
| #1131 | 8 files, +1320/-15 | **5 files, +1106/-5** |
| #1126 | 12 files, +1533/-13 | **7 files, +1028/-12** |
| #1128 | 5 files, +692/-61 | **4 files, +526/-61** |
| #1133 / #1130 / #1124 | — | exact match |

So 4 of 7 over-reported, the worst by ~1.7× on files and ~1.4× on added lines. It is not a fixed factor and
it is not always wrong — which is exactly why it can't be eyeballed. (The open PR #1137 agreed exactly:
5 files, +760/-0 both ways.)

**How to measure it properly.** By hand: `git fetch origin <headRef>` then
`git diff --numstat origin/main...<head>` (three dots — the fork point). In tooling, do **not** re-derive it:
`computeNetDiffSignals` / `computeNetDiffChangedFiles` / `computeNetDiffText` in `scripts/merge-ai-prs.mjs`
already resolve the base once, narrow the left side to `merge-base(origin/main, candidate)` (#2404), and never
check out the branch (#2336). `scripts/pr-land.mjs` and the drain's scoring loop both go through them.
