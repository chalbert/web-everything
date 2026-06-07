---
type: decision
status: open
dateOpened: "2026-06-03"
tags: [pagination, a11y, focus, announcements, collection-ops]
relatedReport: reports/2026-06-03-pagination-standard-research.md
relatedProject: webintents
crossRef: { url: /backlog/013-gap-6-focus-announcements/, label: gap-6 focus & announcements }
---

# Specify focus + screen-reader announcement after a page change

When the user moves to a new page, what should happen to focus and what should be announced? Candidate behavior: move focus to the results region (or the first new item) and announce "page 2 of 10" via a live region — but none of this was independently verified by the pagination research, so it needs a dedicated WAI-ARIA APG / NN-g pass before the pagination a11y trait is final.

This is the pagination-specific instance of the general concern in [gap-6 — Focus & Announcements intent](/backlog/013-gap-6-focus-announcements/); whatever gap-6 decides (centralized `focus` intent vs a11y protocol) is the mechanism this trait would re-point at. The verified part of the a11y story is settled: `<nav aria-label="pagination">` + `aria-current="page"` (W3C WAI-ARIA APG). The unsettled part is the *post-change* focus/announcement behavior.

**Prior art — Data Table announcement pattern (shipped, [Data Table block](/blocks/data-table/)).** The Data Table block now realizes its live-region announcements with a shared shape worth reusing here so the two land on **one** pattern, not two: a single polite `aria-live` region carrying a **clause-joined status string** (`announce()` in `blocks/renderers/data-table/renderDataTable.ts`) — e.g. *"Sorted by Name, ascending; 6 rows"* / *"…; 3 of 6 shown"*. The pagination analogue is the same region holding *"Page 2 of 10"*. What stays open here is the **focus** half (where focus lands after a page change) and whether the region/string composition is hoisted into gap-6; the announcement *shape* is the settled, reusable part.
