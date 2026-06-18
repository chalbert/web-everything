---
type: issue
workItem: task
status: resolved
dateOpened: "2026-06-03"
dateResolved: "2026-06-06"
tags: [pagination, collection-operations, resources, cursor, offset, seam]
relatedReport: reports/2026-06-03-pagination-standard-research.md
relatedProject: webresources
crossRef: { url: /intents/collection-operations/, label: collection-operations intent }
---

# Wire the Custom Pagination resource to the Collection Operations page dimension

> **Resolved 2026-06-06.** The Custom Pagination resource in `we:resources.json` now links to the Collection
> Operations `page` dimension and encodes the pairing constraint on the protocol side: `offset`/`page` expose
> a `total` (enabling jump-to-page + `rangeLabel`), while `cursor` exposes none and forces `append`/prev-next —
> the same fact the intent states from the UX side, now kept consistent here. Original narrative below.

The Custom Pagination resource (`status: draft`) still describes only a generic "InfiniteScroll" consumer. It has no link to the Collection Operations `page` dimension that selects its UX, and — more substantively — **nothing on the resource side encodes the pairing constraint** the pagination research established: the `cursor` strategy exposes no `total` and only `next()/previous()`, which is precisely why it cannot drive jump-to-page or a `rangeLabel`. That fact currently lives only on the intent side.

Close the loop both ways: annotate the resource's `cursor`/`offset`/`page` strategies with their UX consequences (cursor → no total → forces `append`/prev-next; offset/page → total available → enables jump-to-page + range label), and add the bidirectional link so the resource points at the intent's `page` dimension and vice-versa. This keeps the UX-only intent and the technical resource consistent about the same cross-layer constraint.
