---
type: idea
status: open
dateOpened: "2026-06-03"
tags: [collection-operations, pagination, block, implementation, chain]
relatedReport: reports/2026-06-03-pagination-standard-research.md
relatedProject: webblocks
crossRef: { url: /intents/collection-operations/, label: collection-operations intent }
---

# Implement a block for the Collection Operations Intent (the missing blocks layer)

The Collection Operations Intent — including the enriched `page` dimension (`pageMode`, `advance`, `urlSync`, `rangeLabel`) — is spec-only. **No block implements or composes it** (zero references in `blocks.json` or any block-description), so the `UX intent → traits → blocks` chain dead-ends at the intent. Nothing actually renders the `<nav aria-label="pagination">` landmark with `aria-current="page"`, the page-size selector, the `‘showing 21–40 of 500’` range label, or wires `advance:auto` to an IntersectionObserver scroll sentinel.

Decide and build the blocks-layer home: a grid/list block (or a dedicated pagination block) that composes Collection Operations, projects `sortDirection` onto `aria-sort`, and renders the paged controls with the verified a11y contract. This is the same "no runnable implementation" gap the dropdown report flagged, but it is untracked for collection-operations. Until it exists, the pagination standard describes the *what* with no *how*.
