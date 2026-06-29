---
kind: story
size: 2
parent: "1608"
status: active
blockedBy: ["1953"]
dateOpened: "2026-06-29"
dateStarted: "2026-06-29"
tags: []
---

# Migrate project-* card surfaces to product components — bucket D (webcontexts, webbehaviors, webreliability, webworkflows, webpositioning, webcases, webprocess)

Migrate the .section-card / .standard-card surfaces in 7 we:src/_includes/project-*.njk files (~38 occ) to `<standard-section>`/`<standard-card>`: webcontexts, webbehaviors, webreliability, webworkflows, webpositioning, webcases, webprocess. Preserve every `<section>` landmark + wrapper `id` + `<hN id>`. File-disjoint from sibling buckets. Own :8080 render check.
