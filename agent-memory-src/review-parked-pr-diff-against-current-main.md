---
name: review-parked-pr-diff-against-current-main
description: "A parked PR's `gh pr diff` is against its stale merge-base — diff the head against CURRENT main to find the true review surface; sibling PRs may have already landed most of it, and a gate-self touch can be illusory."
metadata:
  node_type: memory
  type: feedback
---

When reviewing a parked PR (`/review`), do NOT judge off `gh pr diff` alone — it renders the PR against its **stale merge-base**, so in a heavily-parallel constellation (lanes + drain, siblings landing continuously) it can show code that has **already landed on main** via other PRs. Fetch the PR head and diff it against **current** `origin/main` (`git diff origin/main..<head>`) to get the true review surface.

This is not cosmetic — it changes a **correctness** judgment. The stale diff misclassifies **gate-self**: a PR whose raw diff "touches" `scripts/merge-ai-prs.mjs` / the review trust chain can, against current main, touch **none of it** (that code already merged via a sibling), so the gate-self / `humanRequired` alarm is illusory. Review the net diff, not the raw one.

**Why:** the drain parks a PR by size/blast-radius against its merge-base; by the time a human reviews it, sibling lanes for the same epic have often landed the overlapping code. Judging the raw `gh pr diff` inflates the surface and can escalate a data-only change as a trust-chain edit. **How to apply:** in `/review`, after `gh pr view`/`gh pr diff`, always `git fetch origin <headRef>` then `git diff origin/main..FETCH_HEAD --stat` — review THAT. Worked example: WE PR #798 — raw diff showed merge-ai-prs.mjs / tick-core.mjs / readiness / ci.yml; net vs current main was 21 backlog data files only (the code had landed via #797/#799/#800). Same family as [[verify-before-you-claim]] and [[humangate-review-is-not-real-escalation]] — verify against live state, not the label; distinct axis is **the review SURFACE itself is stale in the raw PR diff**.
