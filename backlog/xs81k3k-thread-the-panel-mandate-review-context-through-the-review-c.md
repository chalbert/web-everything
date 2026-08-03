---
kind: story
size: 2
status: open
dateOpened: "2026-08-03"
tags: []
---

# Thread the panel-mandate review context through the review-core CLI seam

we:scripts/review-core-cli.mjs's buildMandateText() calls buildPanelMandate({ lens }) with neither #2450's netChangedFiles ground truth nor #2457's coupleRepos/selfRepo couple context, so a reviewer seeded through the CLI seam still false-positives on both classes the library already prevents: a landed sibling-lane file read as scope creep, and a symbol the couple's other half adds read as undefined. The library builders take all three params and are additive; this is pure plumbing plus the CLI flags to carry them and their tests.
