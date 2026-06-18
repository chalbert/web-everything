---
type: issue
workItem: story
size: 2
status: resolved
blockedBy: ["763"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: scripts/check-standards-rules.mjs
tags: []
---

# Static template a11y lint in check:standards (structural rules axe can't assert headless)

Add a static template lint to we:scripts/check-standards.mjs for the structural a11y rules a headless axe run can't observe — e.g. nav links missing aria-current wiring (the #762 instance), landmark/heading structure in .njk source. Complements the rendered-DOM axe gate (#770/#771): the lint catches authoring-time structural misses in templates/_includes before render; axe catches computed/rendered violations. Ratified in #763 as supported-not-decided (ships alongside the axe gate).

## Progress (2026-06-16, batch-2026-06-16) — built

- **Validator:** `validateTemplateA11y(layouts)` in [we:scripts/check-standards-rules.mjs](../scripts/check-standards-rules.mjs) (pure, unit-tested per #256), wired as §11 in [we:scripts/check-standards.mjs](../scripts/check-standards.mjs) reading `src/_layouts/*`.
- **Scope:** the site-chrome layouts only (the #762 regression locus) — spec-content navs (block-descriptions) and in-page breadcrumbs never false-positive.
- **Rules (mirroring the #636 warn→enforce shape):**
  - page-shell landmarks — a full-page layout (`<html`) MUST carry `lang`, a `<title>`, and a `<main>` landmark → **error** (both layouts satisfy these today, so a regression hard-fails — the pre-render coverage axe can't give).
  - nav active-state wiring (#762 class) — a `<nav>` with a hardcoded `<a href=` list MUST wire `aria-current` → **warn** behind `NAV_ACTIVE_STATE_ENFORCED=false`. we:base.njk wires it; the dead/legacy `we:src/_layouts/base.html` (no `layout: we:base.html` refs — all 28 pages use we:base.njk) still has a 7-link nav with no aria-current, so enforcing now would red-gate a pre-existing miss.
- **Tests:** 4 cases in [we:scripts/__tests__/check-standards-rules.test.mjs](../scripts/__tests__/check-standards-rules.test.mjs) (pass; lang/title/main error path, #762 warn path, partial-template skip).
- **Verified:** `check:standards` → 0 errors; the new lint correctly warns on dead we:base.html. `vitest -t validateTemplateA11y` → 4/4 pass.
- **Carved:** delete dead we:base.html + flip `NAV_ACTIVE_STATE_ENFORCED` to enforce (#794).
