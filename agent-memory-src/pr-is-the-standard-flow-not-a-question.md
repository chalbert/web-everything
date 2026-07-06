---
name: pr-is-the-standard-flow-not-a-question
description: "In webeverything, opening a ready-to-merge PR is the mandatory completion of ANY edit-work — never a gated question"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c125b69b-84d6-4120-9730-9f69943fbacb
---

Opening a `ready-to-merge` PR is the **standard, mandatory** end of every edit-work task in webeverything — not an outbound action to confirm. Once the lane commit is made and the gate is green, open the PR without asking.

**Why:** the repo has exactly one land route — lane-clone → ready-to-merge PR → drain (#104, #2183/#2196, #2290 "drain is the sole writer to main"). The drain/`/merge` only lands **open, labelled PRs**; a local lane commit is invisible to it and never lands. So a commit that doesn't become a PR is dead work. My global "commit/push only when the user asks" rule is about generic outward actions — it does NOT apply here, because the project convention makes PR-open intrinsic to the workflow, and project convention wins. The user's "go" to execute the work already authorizes the PR that lands it.

**How to apply:** after a split/batch/backlog/edit lands green in a lane, run `/pr` as the natural final step. Don't surface "want me to open the PR?" as a decision — just do it and report the PR URL in the tail. Only pause if something is genuinely wrong (gate red, ambiguous scope). Relates to [[104-edit-work-runs-in-a-lane-clone]].
