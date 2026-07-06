---
kind: story
size: 5
parent: "2285"
status: open
blockedBy: ["2293"]
dateOpened: "2026-07-05"
tags: [lane, drain, review, merge-queue, multi-agent, agent]
---

# v3: multi-mandate reviewer panel — unanimous accept lands, conflict to review:human

Third slice of #2285, blockedBy v2 (#2293). Extend v2's single reviewer into a panel of distinct mandated reviewers — correctness / security / simplicity / standards-conformance, the /code-review lenses — fanned out via the Workflow orchestrator. They must jointly agree: a unanimous accept lands the PR; any mandate conflict (e.g. security wants X, simplicity wants not-X) or non-convergence escalates to review:human, because a tradeoff between mandates is human judgment by definition. Preserves the #2285 invariant. Settle at spec: which lenses are mandatory vs. advisory; how a split verdict is surfaced to the operator.

**Surface:** builds on the v2 (#2293) negotiation loop, swapping its single reviewer for the panel; the
mandate lenses are `/code-review`'s dimensions.
