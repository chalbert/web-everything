---
kind: task
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: blocks/renderers/pagination (announcePagination + PaginationBehavior persistent live region)
tags: [pagination, a11y, announcements, live-region, collection-ops]
---

# Announce Page N of M via the pagination role=status region on page change

Wire the pagination renderer's existing but un-populated `role="status"` region (`we:renderPagination.ts:88`) to announce *"Page N of M"* (optionally extended with the range clause *"; showing 21–40 of 500"*) on every page change, polite, via the shared clause-joined live-status shape already shipped in Data Table's `announce()`. Ratified in #059 (Fork 2): a content swap the screen-reader user must learn about is a fixed mechanic (WCAG 4.1.3 / ARIA22), not a toggle — there is no legitimate silent end-state. Pagination composes `live-region-status`; this is the thin renderer wiring, no new intent.

## Progress

**Resolved 2026-06-12** → `blocks/renderers/pagination/`.

- `we:renderPagination.ts` — added the pure `announcePagination(state, opts)`: the clause-joined string `"Page N of M[; Showing a–b of N]."`, reusing Data Table's `announce()` shape (one polite region, `clause; clause; .`) per the #059 note that the two share the pattern. Returns `''` under a cursor protocol (no page count → no "of M" to state; a bare "Page N" would be noise).
- `we:PaginationBehavior.ts` — wired it to a **persistent** polite `role="status"` `aria-live="polite"` live region. **Correction to the card's premise:** the renderer's `role=status` region is re-created on every re-render, so it *cannot* announce (a screen reader announces mutations to a region already present in the DOM). The behavior therefore owns the live region — created once, sr-only, its `textContent` updated on each `goto()` — which is the only way the announcement actually fires. Silent on initial mount; announces on change.
- Tests: a new behavior test asserts the region is the same node across a re-render (persistence) and reads `"Page 3 of 10; Showing 101–150 of 500."` after a page change. 22 pagination tests green; `check:standards` green.
