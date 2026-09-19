---
kind: story
size: 5
status: open
scope: ["we:scripts/lib/advisory-labels.mjs", "we:scripts/operations/review-pr.mjs", "we:scripts/operations/review-pr-io.mjs", "we:scripts/operations/operator-queue.mjs", "we:scripts/conveyor/advisory-label-sweep.mjs", "we:skills-src/review/SKILL.md", "we:docs/agent/delivery-loop.md"]
dateOpened: "2026-09-19"
tags: []
---

# Make the advisory-accepted signal a real advisory:accepted / advisory:changes label, and gate the operator queue on it

On a review:human PR the independent advisory records no verdict, so a clean advisory looked identical to one never run. The advise step (we:scripts/operations/review-pr.mjs, we:scripts/operations/review-pr-io.mjs) now applies advisory:accepted or advisory:changes on the current head and drops review:pending; we:scripts/conveyor/advisory-label-sweep.mjs drops both on a new commit; we:scripts/operations/operator-queue.mjs hard-gates NEEDS YOU on the label, cross-checks it against the parsed advisory comment, and re-polls transient mergeable UNKNOWN into a separate PENDING bucket. Labels and definitions: we:scripts/lib/advisory-labels.mjs.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
