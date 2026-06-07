---
type: idea
status: resolved
dateOpened: "2026-06-03"
dateResolved: "2026-06-06"
graduatedTo: intent:collection-operations
tags: [pagination, numbered, page-size, labels, collection-ops]
relatedReport: reports/2026-06-03-pagination-standard-research.md
relatedProject: webintents
---

# Verify best-practices for result-range labels and page-size selectors

`"Showing 21–40 of 500"` result-range labels and page-size selectors (10 / 25 / 50 / 100) are standard numbered-pagination affordances, but the pagination research surfaced **no verified claim** defining their best practices — recommended page-size options, sensible defaults, whether the choice persists across sessions, and how the range label degrades when the total count is unavailable (cursor protocols have no total).

Verify these against UX authorities before exposing them as dimensions of the pagination presentation trait. Note the cross-layer constraint already established: both affordances require an offset/page protocol (cursor cannot produce a total), so they are only valid in the numbered presentation over offset/page.

## Resolution (2026-06-06)

Verified against NN/g, Baymard, W3C WCAG/ARIA, GOV.UK, and the documented pagination components of Carbon, MUI/Material, Ant, Polaris, USWDS, Primer, Atlassian. Findings (with confidence + sources) are in the `relatedReport` — *Result-range labels & page-size selectors (verified 2026-06-06)*. Graduated into the **Collection Operations `page` dimension**:

- New **`pageSize`** dimension (`fixed | selectable`); persist the choice across sessions by default (NN/g); option ladder + size are app-owned (10/25/50/100 is a defensible default, but NN/g favours one default + few options).
- **`rangeLabel`** enriched with the no-total degradation ladder (drop total → `21–40`; never "of many") and the `role="status"` + `aria-atomic` WCAG-4.1.3 announcement mandate.

Honest framing carried into the spec: the labels/ladder are *de facto convention*, not controlled research; the only authority-backed mandate is the live-region announcement.
