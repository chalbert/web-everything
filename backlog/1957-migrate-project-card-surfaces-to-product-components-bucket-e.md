---
kind: story
size: 2
parent: "1608"
status: resolved
blockedBy: ["1953"]
dateOpened: "2026-06-29"
dateStarted: "2026-06-29"
dateResolved: "2026-06-29"
tags: []
---

# Migrate project-* card surfaces to product components — bucket E (webcomponents, webrouting, webrealtime, webresources, webpolicy, webcompliance, webanalytics)

Migrate the .section-card / .standard-card surfaces in 7 we:src/_includes/project-*.njk files (~40 occ) to `<standard-section>`/`<standard-card>`: webcomponents, webrouting, webrealtime, webresources, webpolicy, webcompliance, webanalytics. Preserve every `<section>` landmark + wrapper `id` + `<hN id>`. File-disjoint from sibling buckets. Own :8080 render check.
