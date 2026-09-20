---
bornAs: x30inwx
kind: story
size: 3
parent: "3549"
status: open
scope: ["we:scripts/conveyor/parked-pr-progress-watch.mjs", "we:scripts/conveyor/__tests__/parked-pr-progress-watch.test.mjs"]
dateOpened: "2026-09-14"
tags: []
---

# Neglect watch: a completed FIX with no follow-up REVIEW leaves review:changes stuck forever

Carved out while fixing epic #3383's #2035-shaped re-park gap in `we:scripts/conveyor/parked-pr-progress-watch.mjs`.
One adjacent gap remains, confirmed on PR #2047: `fix-2047` completed inside the current `review:changes`
park window, so the fixed predicate correctly does not call it never-dispatched — yet the PR stays
`review:changes` for days, because the completed fix never triggered a follow-up review, and only a review
clears that label. The predicate can't tell "some session ran recently" from "the action THIS state is owed
ran recently." Needs its own design pass, mirroring `we:3596`'s carve-out.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
