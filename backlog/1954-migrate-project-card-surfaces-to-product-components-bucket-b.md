---
kind: story
size: 2
parent: "1608"
status: resolved
blockedBy: ["1953"]
dateOpened: "2026-06-29"
dateStarted: "2026-06-29"
dateResolved: "2026-06-29"
graduatedTo: "we:src/_includes/project-{webexpressions,webregistries,webmanifests,webtraces,webtheme,webintents,weblayout}.njk migrated to standard-section/standard-card product components (44 surfaces: 39 section-cards + 3 standard-card content cards; intro-section/details/a.standard-card link tiles preserved)"
tags: []
---

# Migrate project-* card surfaces to product components — bucket B (webexpressions, webregistries, webmanifests, webtraces, webtheme, webintents, weblayout)

Migrate the .section-card / .standard-card surfaces in 7 we:src/_includes/project-*.njk files (~42 occ) to `<standard-section>`/`<standard-card>`: webexpressions, webregistries, webmanifests, webtraces, webtheme, webintents, weblayout. Preserve every `<section>` landmark + wrapper `id` + `<hN id>`. File-disjoint from sibling buckets. Own :8080 render check (landmarks, :target, heading anchors).
