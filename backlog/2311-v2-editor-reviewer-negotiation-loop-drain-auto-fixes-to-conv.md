---
kind: story
size: 5
parent: "2285"
status: open
blockedBy: ["2286"]
dateOpened: "2026-07-05"
tags: [lane, drain, review, merge-queue, multi-agent, agent]
---

# v2: editor↔reviewer negotiation loop — drain auto-fixes to convergence

Second slice of #2285. Replace v1's author-bounce (a review:changes verdict routes the fix back to the author lane) with a bounded editor↔reviewer convergence cycle in the /drain auto-review ceremony: an editor agent proposes a fix, the reviewer agent critiques, iterate until the reviewer accepts or an N-round cap trips — non-convergence escalates to review:human. Composes on the Workflow orchestrator (deterministic loop-until-agreement). The final landed state is reviewer-approved, so the #2285 invariant (a landed diff signed off by a non-author) holds. Settle at spec: the round-cap N; where the editor writes (its own lane clone vs. a direct push).

**Surface:** modifies the v1 auto-review ceremony —
[we:skills-src/drain/SKILL.md:128-137](skills-src/drain/SKILL.md#L128-L137) (the `changes` verdict step
that today routes back to the author lane).
