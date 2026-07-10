---
kind: story
size: 5
parent: "777"
status: resolved
dateOpened: "2026-07-09"
dateStarted: "2026-07-10"
dateResolved: "2026-07-10"
tags: []
graduatedTo: frontierui/tests/a11y/sitemap-routes.ts
---

# Drain the FUI-site a11y mirror gate (seed its empty ENFORCED_ROUTES)

The FUI website's mirror a11y gate (fui:tests/a11y/sitemap-routes.ts) has an empty enforced seed — zero routes promoted. Per #867's per-repo mirroring: measure fui: scope-C routes, remediate the red ones, and seed fui ENFORCED_ROUTES per the same Fork 1/Fork 2 rulings. Mirrored, not shared (#774/#849 precedent).

Measured all 8 scope-C routes (`/`, `/about/`, `/adapters/`, `/blocks/`, `/blocks/annotation/`, `/demos/`, `/plugs/`, `/traits/`) against the live FUI docs site with `@axe-core/playwright`: 6/8 were red on `[serious] color-contrast` — the site-wide `--color-primary` teal (#0d9488, 3.32–3.74:1 against white/badge backgrounds) and the inherited "One Dark" inline-code red (#e06c75, 2.7:1 against its light pill background), plus one `opacity: 0.8`-faded link pair on `/traits/`. Remediated: darkened `--color-primary` to Teal-700 `#0f766e` (and `--color-primary-hover` to Teal-800 `#115e59`) in `frontierui:src/css/style.css`; darkened the inline-code color to Red-700 `#b91c1c` in `frontierui:src/css/prism-theme.css` (mirrors WE's own #793 fix for the identical One Dark token); replaced the `opacity: 0.8` de-emphasis wrapper with `color: var(--color-text-muted)` in `frontierui:src/traits.njk` (opacity blends the whole subtree including child links against the backdrop — a child can't opt back out of an ancestor's alpha). All 8 routes re-measured green; seeded all 8 into `frontierui:tests/a11y/sitemap-routes.ts`'s `ENFORCED_ROUTES` (Fork 1 decoupled — promote every scope-C route that measures green, mirroring WE's #2378 ruling).
