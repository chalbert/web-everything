---
bornAs: xxzv5jw
kind: story
size: 3
parent: "2418"
status: resolved
blockedBy: ["2435", "2432"]
dateOpened: "2026-07-11"
dateStarted: "2026-07-14"
dateResolved: "2026-07-14"
tags: []
---

# review-parked-prs Workflow: pipeline the panel↔editor↔re-review loop

Encode the drain's review loop as a Workflow script (new we:scripts/workflows/review-parked-prs.mjs): pipeline(parked, panelReview → reducePanelVerdict → editorRound → reReview), calling we:scripts/lib/review-core.mjs inside, returning {pr, disposition, verdict, commentBody} per PR. Collapses ~24 hand-run main-loop steps into one launch. Blocked by the review-core CLI (reduce/mandate) and the PR comment renderer.
