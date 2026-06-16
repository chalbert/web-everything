---
type: idea
workItem: story
size: 3
parent: "777"
status: open
dateOpened: "2026-06-16"
tags: [dogfood, fui, inventory, site-rework, audit]
---

# Inventory WE-docs hand-written UI and map each surface to its FUI component

Audit the WE-docs site's bespoke UI and produce the migration map for the #777 dogfood-rework epic. Enumerate every chrome + page-level surface in src/_layouts/base.njk, src/css/style.css, src/assets/js/reveal-nav.js, and the src/*.njk page templates / src/_includes/** — header, nav (the #645 reveal-nav), footer, layout shell, catalog tiles/cards, tables, badges, buttons, code-sample frame, etc. For each surface name the FUI block/component that would replace it and flag which ones FUI must still build (feeds #658). Pure research/audit — no boundary dependency, so it runs ahead of the #765 relaxation gate. Output: a report + the per-surface mapping that the (gated) migration slices consume.
