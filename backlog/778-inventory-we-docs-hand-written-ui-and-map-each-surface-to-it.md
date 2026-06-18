---
type: idea
workItem: story
size: 3
parent: "777"
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: reports/2026-06-16-we-docs-ui-inventory-fui-map.md
relatedReport: reports/2026-06-16-we-docs-ui-inventory-fui-map.md
tags: [dogfood, fui, inventory, site-rework, audit]
---

# Inventory WE-docs hand-written UI and map each surface to its FUI component

Audit the WE-docs site's bespoke UI and produce the migration map for the #777 dogfood-rework epic. Enumerate every chrome + page-level surface in we:src/_layouts/base.njk, we:src/css/style.css, we:src/assets/js/reveal-nav.js, and the src/*.njk page templates / src/_includes/** — header, nav (the #645 reveal-nav), footer, layout shell, catalog tiles/cards, tables, badges, buttons, code-sample frame, etc. For each surface name the FUI block/component that would replace it and flag which ones FUI must still build (feeds #658). Pure research/audit — no boundary dependency, so it runs ahead of the #765 relaxation gate. Output: a report + the per-surface mapping that the (gated) migration slices consume.

## Progress (2026-06-16, batch-2026-06-16) — built

- Produced the audit report: [we:reports/2026-06-16-we-docs-ui-inventory-fui-map.md](../reports/2026-06-16-we-docs-ui-inventory-fui-map.md) (exposed via `relatedReport`).
- **10 chrome surfaces** (we:base.njk header/nav/footer/shell + we:reveal-nav.js) and **10 page-level surfaces** (catalog tiles, sortable tables, toolbar, badges, buttons, code frame, toggles, meters, project layout, fui-demo) enumerated, each mapped to a FUI block.
- **Coverage delta:** 8 surfaces covered by existing FUI blocks (`nav-list`, `event-behaviors`, `data-grid`, `type-ahead`, `tabs`/`selection`/`droplist`, `master-detail`); **8 FUI must-build gaps** feed #658 (`button`, `disclosure`/sectioned-nav, app-shell/header, `card`, filter-chip, `badge`, `code-block`, `meter`, `toc`); 3 theme-only; 1 excluded (dev-only Spec Explorer).
- Pure research; no boundary dependency (ran ahead of the #765 gate). The per-surface map + sequencing hints are what the gated #777 migration slices consume.
