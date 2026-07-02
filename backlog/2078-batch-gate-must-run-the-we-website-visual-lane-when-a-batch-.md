---
kind: story
size: 5
status: resolved
dateOpened: "2026-07-01"
dateResolved: "2026-07-02"
graduatedTo: 2000
tags: []
---

# Batch gate must run the WE-website visual lane when a batch touches FUI theme tokens (cross-repo blast radius)

Live regression from batch-2026-07-01-1947-2071: #2050 defined surface-card/border-light/text-secondary as DARK values in fui:plugs/webtheme/defaultTheme.ts; the WE light site (we:src/_data/weSiteTheme.js) had no override for those names, so the dark values leaked and the dogfooded fui-card home tiles (#2019) rendered near-black. It shipped because #2050 gated ONLY in the FUI lane (check:standards never renders a page) and the WE-website visual lane (#2070) had carried — nothing rendered the WE site in-gate. Fix: when a batch/lane touches FUI theme/token sources (fui:plugs/webtheme/*, defaultTheme, LEGACY_ALIASES), the integrator must run the WE-website visual/Playwright lane against the rebuilt site before landing, since WE consumes FUI theming cross-origin (#96). Depends on / extends we:#2070 (WE-visual in CI). Guard added this session: we:scripts/lib/__tests__/token-css.test.mjs (unit-level dark-leak check) — but a real render gate is still owed.
