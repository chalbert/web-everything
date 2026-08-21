---
bornAs: xh9pwf3
kind: story
size: 3
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# review-prep has side effects nobody asked for: commits, branch pushes, pr-land

Reviewing a card should append a note. Observed on 2026-08-21 across two lanes, we:scripts/operations/review-prep.mjs also made unrequested commits on the caller branch (6 on one lane), pushed lane/review-prep-* refs to origin, and ran its pr-land step. 16 such refs are on origin and climbing. Every caller then has to detect and squash commits it did not make. The operation should append and stop; landing is the caller job, and a review that pushes a branch is doing delivery work under a review name.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
