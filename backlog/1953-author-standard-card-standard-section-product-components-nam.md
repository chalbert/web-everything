---
kind: story
size: 3
parent: "1608"
status: resolved
dateOpened: "2026-06-29"
dateStarted: "2026-06-29"
dateResolved: "2026-06-29"
graduatedTo: "we:src/_includes/product-components.njk (standard-card + standard-section product components composing FUI we-card/we-section-card; namespace knob in src/_data/site.js componentNamespace + .eleventy.js componentTag global; SSR baseline in src/css/style.css; pilot-migrated src/_includes/project-webportals.njk 20 section-cards)"
tags: []
---

# Author standard-card + standard-section product components + namespace config knob (pilot-migrate webportals)

Author the WE-website product components `standard-card` (composes FUI `we-card`) and `standard-section` (composes FUI `we-section-card`), plus the namespace config knob (default empty → unprefixed). Pilot-migrate we:src/_includes/project-webportals.njk (21 occ) as the end-to-end proof — preserves `<section>` landmark + wrapper `id` + each `<hN id>` so `#anchor` TOC links and `.section-card:target` survive. Gate npm run verify + a :8080 render check on /webportals. Foundational: blocks all migration slices.
