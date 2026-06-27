---
kind: story
size: 3
parent: "1601"
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: none
tags: []
---

# Migrate the remaining top-level catalog tiles to we-card (adapters/plugs/protocols/states/resources/presets)

Follow-up to #1607, which migrated the intents + blocks anchor-tile catalogs (the surfaces #1820 Fork 1a explicitly ruled + verified). The sibling top-level catalog grids — we:src/adapters.njk, we:src/plugs.njk, we:src/protocols.njk, we:src/states.njk, we:src/resources.njk, we:src/presets.njk — carry the same .project-card tile shape and follow the SAME pattern #1607 established: wrap the tile body in a we-card, status pill to we-badge[tone], type/dimension chips to we-tag, click-through + filter data-* stay on the outer anchor, and the global .project-card:has(> we-card) frame-strip rule (already shipped in #1607, we:src/css/style.css) prevents the double-frame. Each catalog needs its own status-enum to 5-tone map + a chip-vocabulary check (their pills are not all status-indicator/tag) + a :8080 render/filter verify, which is why they are carved here rather than force-fit under #1607. we:src/design-systems.njk stays separate (its div tiles + status-meter are #1820 Fork 2). Gate: npm run verify + :8080 render check.
