---
kind: story
size: 5
status: open
blockedBy: ["2152"]
relatedTo: ["2123", "2138"]
dateOpened: "2026-07-02"
tags: [lane, pr-flow, integrator, session-tooling]
---

# Land lanes via self-approved PRs / GitHub merge queue in the drain command

Implements the self-approved-PR substrate for the #2138 drain: instead of a local git merge + push origin main, each ready lane opens a self-approved PR (gh pr create) and the merge/monitor session drains via gh pr merge — pulling, rebasing, resolving conflicts when GitHub reports the branch unmergeable. **#2138 Fork 5 (ruled): the custom drain owns every merge in impl-first/WE-last order; GitHub's native merge queue stays OFF** (it would reorder couples). PRs are the review/CI surface, not an autonomous merge mechanism; local `git merge` is the fallback. gh-authed (`chalbert`); remaining block is #2152.
