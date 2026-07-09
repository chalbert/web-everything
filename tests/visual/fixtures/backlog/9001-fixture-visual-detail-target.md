---
kind: story
size: 3
status: open
dateOpened: "2026-01-01"
tags: [fixture, visual-regression, determinism]
blockedBy: [9002]
---

# Fixture — frozen visual-regression detail target

This is a **frozen fixture item** (backlog item 2236), not a real backlog entry — it exists only so the
visual-regression spec (`we:tests/visual/rendered-site-visual.spec.ts`) has a `/backlog/<id>/` detail
page whose content never changes, so a screenshot diff only fires on a genuine STYLE/LAYOUT regression,
never on backlog-content churn (a new item filed, an unrelated item resolved, a title edit elsewhere).

It carries one resolved `blockedBy` edge (fixture item 9002) and one open dependent (fixture item 9003)
so the detail page's badge set — status, tier, tags, "blocked by (resolved)", and a dependents/leverage
count — all render deterministically, exercising the same `section-card` layout a real detail page uses.

Do not resolve, retag, or otherwise "clean up" this item — it is intentionally static. To add a new
visual target against this fixture set, see the header comment in `we:tests/visual/pages.json`.
