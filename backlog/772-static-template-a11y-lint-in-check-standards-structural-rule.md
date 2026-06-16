---
type: issue
workItem: story
size: 2
status: open
blockedBy: ["763"]
dateOpened: "2026-06-16"
tags: []
---

# Static template a11y lint in check:standards (structural rules axe can't assert headless)

Add a static template lint to scripts/check-standards.mjs for the structural a11y rules a headless axe run can't observe — e.g. nav links missing aria-current wiring (the #762 instance), landmark/heading structure in .njk source. Complements the rendered-DOM axe gate (#770/#771): the lint catches authoring-time structural misses in templates/_includes before render; axe catches computed/rendered violations. Ratified in #763 as supported-not-decided (ships alongside the axe gate).
