---
kind: task
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# Do jurors receive a line-offset view of large files through review-prep?

Two independent jurors on one lane reported that the same file line citations were stale by a similar constant offset, on the same day; the lane re-verified in two clones and its numbers were right. Two jurors agreeing on a wrong offset for one file is more likely a rendering defect in what the juror is handed than two coincidental errors. Investigate how we:scripts/operations/review-prep.mjs materializes a large file for a juror. If real, every line-anchored finding on a big file is suspect and the cost is jurors sending authors to the wrong place. If not real, record that so the next occurrence is not re-investigated.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
