---
kind: decision
size: 3
parent: "099"
status: open
dateOpened: "2026-06-21"
tags: [decision, book-candidate, annotation, highlight, selection, gap]
---

# Content annotation — highlight / comment-on-selection standard: placement

Verb-axis straggler (completeness sweep of [#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)):
select a span of content and attach something to it — highlight, comment, footnote, suggestion — anchored
so it survives re-render and (ideally) edits. A pervasive pattern (docs, PDFs, review tools, e-readers) WE
owns nothing for.

**Decision:** is this a WE standard at all, and if so its shape — an `annotation` intent (anchor + payload +
overlay), a behavior over text selection, or out-of-scope as app-specific. Likely overlaps the
production-teardown lens ([#1404](/backlog/1404-discovery-lens-production-app-teardown-inventory-real-apps-d/)).
Native substrate to check: CSS Custom Highlight API, `Range` / `Selection`, W3C Web Annotation data model.
**Needs `/prepare`.** Unsure ⇒ decision; costs nothing.
