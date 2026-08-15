---
kind: story
size: 2
status: open
blockedBy: ["3067"]
dateOpened: "2026-08-15"
tags: [gate, review, independence, guard]
scope:
  - we:scripts/review-set-label.mjs
  - we:scripts/lib/auto-land-seam.mjs
---

# Wire #3067's stamp-lost detection into we:review-set-label.mjs and we:auto-land-seam.mjs

#3067 built the pure detect/distinguish/repair primitives (date-based + marker-based STAMP_LOST) in we:scripts/lib/review-independence.mjs and the --repair recovery mode in we:scripts/pr-body-edit.mjs, scoped to those two files only. Neither consumer calls them yet: we:scripts/review-set-label.mjs reads prBody but never passes prCreatedAt or hasStampLostMarker(prBody) into decideClearerIndependence, and its refusal check only matches SELF_CLEAR, not STAMP_LOST — so a stripped-and-detected stamp still reads (and is tolerated) as unknown-author on the invoked CLI path. we:scripts/lib/auto-land-seam.mjs already refuses everything but independent:true, so it needs only the two new inputs threaded through, no new branch. Wire: (1) we:scripts/review-set-label.mjs's existing gh pr view call to also fetch createdAt (one more --json field, no extra hop) and pass it as prCreatedAt; (2) we:scripts/review-set-label.mjs to compute stampLostMarked via hasStampLostMarker(prBody) and pass it too; (3) we:scripts/review-set-label.mjs's --to=accepted refusal check to also fire on INDEPENDENCE.STAMP_LOST, with its own named remedy (run we:scripts/pr-body-edit.mjs --repair, or the clear-human ceremony) mirroring the existing SELF_CLEAR message style.
