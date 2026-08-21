---
kind: story
size: 3
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# Gate review-pr on the PR being OPEN, before the juror is paid

The inert-verdict predicate already exists and works: we:scripts/review-set-label.mjs refuses a verdict on a non-OPEN PR (#2953). But it only runs at the END of the chain, inside CI, after jurors have been paid. we:scripts/operations/review-pr-io.mjs reads no PR state at all. On 2026-08-20 that cost three juror rounds (~$4) and five orphaned commits against PR #1503, which had merged two hours before round 1 started. Lift the same predicate into review-pr.read so the refusal happens before the judge step — single-home style: shell the existing home, classify what it said, never reimplement it.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
