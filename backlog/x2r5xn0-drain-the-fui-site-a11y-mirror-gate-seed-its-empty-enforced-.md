---
kind: story
size: 5
parent: "777"
status: open
dateOpened: "2026-07-09"
tags: []
---

# Drain the FUI-site a11y mirror gate (seed its empty ENFORCED_ROUTES)

The FUI website's mirror a11y gate (fui:tests/a11y/sitemap-routes.ts) has an empty enforced seed — zero routes promoted. Per #867's per-repo mirroring: measure fui: scope-C routes, remediate the red ones, and seed fui ENFORCED_ROUTES per the same Fork 1/Fork 2 rulings. Mirrored, not shared (#774/#849 precedent).
