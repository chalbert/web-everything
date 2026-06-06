---
type: decision
status: open
dateOpened: "2026-05-31"
tags: [gap-analysis, project, intent, scroll, observation]
---

# Decide on Scroll/Observation project — `webscroll` (gap #7)

IntersectionObserver, scroll-driven animations (`animation-timeline`), scroll-snap, virtualization, infinite scroll, `content-visibility`. The `prefetch` intent touches `viewport` eagerness but nothing owns scroll as a domain.

## Triage context

- **Kind**: Project and/or Intent
- **Native anchor**: IntersectionObserver, scroll-driven animations, scroll-snap, `content-visibility`
- **Native-first**: ◆ medium · **Gap**: ◆ medium · **Effort**: ◆ medium
- **Rank**: 7

## Open call

Project vs intent — and whether to subsume the existing `prefetch`/`viewport` eagerness handling.

**Seam to resolve (added 2026-06-03):** the Collection Operations Intent's `advance:auto` page trigger is an IntersectionObserver scroll-proximity concern. Decide whether that scroll trigger stays owned by `collection-operations` or delegates to this domain — it overlaps directly with the "infinite scroll / IntersectionObserver" surface above. See [pagination-windowed-collection-seam](/backlog/062-pagination-windowed-collection-seam/) and the 2026-06-03 pagination research report.
