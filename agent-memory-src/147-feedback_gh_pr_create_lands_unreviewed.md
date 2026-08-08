---
name: feedback_gh_pr_create_lands_unreviewed
description: "A PR opened with plain `gh pr create` carries no review:* label, and absence is NOT a hold — the drain mints ready-to-merge on green and lands it unreviewed. Open PRs via pr-land, or apply review:pending in the same breath."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 01f39b97-274a-4078-8eeb-e7f8d6008673
---

A PR opened with plain `gh pr create` carries **no `review:*` label**, and an absent review label is **not** a hold. `hasUnclearedReviewLabel` returns `false` for an unlabelled PR, and `shouldLabelOnGreen` then mints `ready-to-merge` on any producer-owned AI PR the moment its required check reads green. The resident drain daemon lands it with no review at all.

**Why:** the label set IS the gate, and holds are POSITIVE labels (`review:pending`, `review:changes`, `review:human`). Absence means "nothing is holding this" — deliberate, not a bug (#2929 sweeps the retired "unlabelled is a hold" framing out of the corpus). The producer path applies the label; hand-rolling the PR skips it. Observed live 2026-08-08: PR #1088 was opened with `gh pr create`, the daemon labelled it green-ready, and it merged **before the review agent dispatched against it reported back**. The review found a real defect (a duplicate backlog item) that only got fixed because a second push beat the drain.

**How to apply:** open PRs through `pr-land` (which labels), using `--park=review:pending` when a hold is wanted. If you do reach for `gh pr create`, apply `review:pending` in the SAME step — never "I'll label it after the review comes back", because on a green PR there is no after. Relates to [[feedback_commit_to_default_branch_ok]] and [[lane-pr-is-universal-delivery-all-repos]].
