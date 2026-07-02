---
kind: story
size: 5
status: open
blockedBy: ["2138", "2151", "2152"]
relatedTo: ["2123", "2138"]
dateOpened: "2026-07-02"
tags: [lane, pr-flow, merge-queue, integrator, session-tooling]
---

# Land lanes via self-approved PRs / GitHub merge queue in the drain command

Implements the self-approved-PR substrate for the #2138 merge-queue drain (user direction 2026-07-02): instead of a local git merge + push origin main, each ready lane opens a self-approved PR (gh pr create) and the merge/monitor session drains via gh pr merge — pulling, rebasing, resolving conflicts on the branch when GitHub reports it unmergeable, always converging through a PR. GitHub's native merge queue absorbs the single-repo WE case; cross-repo couples (WE+FUI+plateau) keep the custom sequencing the per-repo queue can't do. Precondition gh-authed: done (`chalbert`, 2026-07-02). Blocked by #2138 (substrate fork), #2151 (PR CI check), #2152 (branch protection).
