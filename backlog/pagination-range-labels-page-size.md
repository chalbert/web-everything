---
type: idea
status: open
dateOpened: "2026-06-03"
tags: [pagination, numbered, page-size, labels, collection-ops]
relatedReport: reports/2026-06-03-pagination-standard-research.md
relatedProject: webintents
---

# Verify best-practices for result-range labels and page-size selectors

`"Showing 21–40 of 500"` result-range labels and page-size selectors (10 / 25 / 50 / 100) are standard numbered-pagination affordances, but the pagination research surfaced **no verified claim** defining their best practices — recommended page-size options, sensible defaults, whether the choice persists across sessions, and how the range label degrades when the total count is unavailable (cursor protocols have no total).

Verify these against UX authorities before exposing them as dimensions of the pagination presentation trait. Note the cross-layer constraint already established: both affordances require an offset/page protocol (cursor cannot produce a total), so they are only valid in the numbered presentation over offset/page.
