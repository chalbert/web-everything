---
kind: story
size: 5
parent: "1601"
status: open
dateOpened: "2026-06-30"
tags: []
---

# Migrate bare .section-card / .standard-card surfaces to also emit .fui-card (unblocks #1895 dead-CSS sweep)

The ~14 templates that use .section-card/.standard-card BARE (no .fui-card) — we:src/backlog-pages.njk, we:src/state-pages.njk, we:src/conformance.njk, we:src/plug-pages.njk, we:src/demos.njk, etc. — must be migrated so each surface ALSO carries .fui-card (or .fui-card confirmed globally loaded on those pages). Until then #1895 cannot retire the bespoke frame in we:src/css/style.css without a visual regression (the frame is load-bearing on /backlog/ where .fui-card lands cross-origin only). Verify with before/after Playwright on the running dev server.
