---
bornAs: xyihiji
kind: story
size: 3
blockedBy: ["3043"]
status: open
dateOpened: "2026-08-06"
tags: []
---

# Migrate the parked-PR review harness onto the extracted convergence core

Once the core is proven on the zero-blast-radius /converge caller, move we:scripts/workflows/review-parked-prs.mjs onto it so the loop's control flow exists ONCE. Deliberately LAST: the parked-PR path is production and currently working, so it migrates after the core has a real caller, not before (the jury's sequencing finding — proving a new core on the production path first risks the drain while delivering none of the asked-for capability).

`blockedBy: 3043` (added at the PR #1106 review). The two bodies this item merges are gated DIFFERENTLY today: the parked-PR loop's editor is care-gated to `low` (#2908) and we:scripts/lib/converge-core.mjs's `convergeStep` is not gated at all. Merging them picks one of those answers whichever way it is written, so `3043` — the decision about whether #2908 extends to the `/converge` loop — must be ruled first. Without the edge this item could land first and decide that fork by accident.
