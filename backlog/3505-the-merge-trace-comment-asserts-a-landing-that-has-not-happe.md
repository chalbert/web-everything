---
bornAs: x4l57g0
kind: task
status: open
dateOpened: "2026-09-06"
tags: []
---

# The merge-trace comment asserts a landing that has not happened yet

we:scripts/merge-ai-prs.mjs posts the merge-trace comment - rendered as `landed head <sha> - merged by drain` - before the gh pr merge write, by design (#2412 Gap 2 wants the SHA about to land recorded even if the pass dies mid-merge). The stamp position is defensible; the wording is not. It states an accomplished landing in the past tense, so a merge that throws leaves a false landing record on a still-open PR, and the next pass posts a second, contradictory one. Wants wording that matches what the stamp can actually know at that point.

## Done when

1. **Executable** — a test asserting the pre-merge stamp's rendered text does not claim a completed landing.
2. The wording states what is true at stamp time (the head about to be merged), so a merge that throws leaves
   an accurate record rather than a false one.
3. The stamp keeps its current position — posting before the write is deliberate (#2412 Gap 2) so a pass that
   dies mid-merge still leaves the SHA. Only the tense changes.
