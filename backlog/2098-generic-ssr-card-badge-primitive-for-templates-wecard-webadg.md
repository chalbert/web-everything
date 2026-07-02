---
kind: story
size: 3
parent: "2021"
status: open
dateOpened: "2026-07-02"
tags: []
---

# Generic SSR card/badge primitive for templates (weCard/weBadge macros + per-page splice transform)

Template-facing SSR primitive the #2016 grid shortcodes never built: weCard/weBadge placeholder macros plus a per-page build transform (the spliceDataTables precedent, we:.eleventy.js:275-278) that batches ALL of a page's card/badge specs through renderComponents (we:scripts/lib/component-render-build-hook.cjs:82-97) in ONE FUI-CLI subprocess call — a naive per-card shortcode would spawn ~800 subprocesses per build. Unit tests beside we:scripts/lib/__tests__/component-render-build-hook.test.mjs. Proof-of-life in-slice: convert we:src/semantics.njk (1 section-card) to the primitive. SSR output byte-identical to the client we-card upgrade; JS-off correct; Playwright before/after.
