---
kind: story
size: 3
status: open
blockedBy: ["xztipiw"]
dateOpened: "2026-08-06"
tags: []
---

# Migrate the parked-PR review harness onto the extracted convergence core

Once the core is proven on the zero-blast-radius /converge caller, move we:scripts/workflows/review-parked-prs.mjs onto it so the loop's control flow exists ONCE. Deliberately LAST: the parked-PR path is production and currently working, so it migrates after the core has a real caller, not before (the jury's sequencing finding — proving a new core on the production path first risks the drain while delivering none of the asked-for capability).
