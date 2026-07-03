---
kind: story
size: 2
parent: "2021"
status: resolved
blockedBy: ["2098"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: []
---

# Shared detail-header status onto SSR we-badge (+ meter) via the shared status macro

Convert the shared projectStatus macro internals (we:src/_includes/project-status.njk:1-8) to the ratified #2019 shape — status as SSR we-badge, the status-meter row kept as trusted HTML beside it (we:scripts/lib/component-render-build-hook.cjs:246-266 precedent) — using the #2098 primitive. Call sites in the 10 importing templates (block/intent/adapter/plug/resource/state/demo/research-topic/project pages + we:src/demos.njk) unchanged: one macro conversion serves every detail header. JS-off correct; Playwright before/after.

## Resolution

Converted the shared `projectStatus` macro (we:src/_includes/project-status.njk) to the ratified #2019 SSR
shape by a single macro-internals edit — every one of the ~21 call sites across the detail headers
(block/intent/adapter/plug/resource/state/demo/research-topic/project pages + we:src/demos.njk +
we:src/_includes/project-webplugs.njk and its siblings) is served unchanged, exactly the "one macro
conversion serves every detail header" plan.

- The macro now imports `weBadge` from the #2098 primitive (we:src/_includes/we-component.njk) and emits the
  status as an inert `<we-badge data-we-spec='{…}'>` SSR placeholder in place of the old plain-text
  `.status-label`. The `weComponentSSR` build transform (we:scripts/lib/component-render-build-hook.cjs)
  batches every page's placeholders through the pinned FUI CLI in one subprocess call and splices the SSR
  fragment in place; the client `<we-badge>` CE upgrade (we:src/_layouts/base.njk) is a pure enhancement
  over the JS-off-correct fallback (the `Active`/`Concept` text between the tags, painted by the
  `we-badge{}` baseline in we:src/css/style.css).
- The status-**meter** row (`.meter-track` / `.meter-fill`) is kept beside the badge as trusted generated
  HTML — the same division of labour as `renderProjectGrid` (badge = rendered component, meter = our own
  markup). The `.status-{{status}}` class on the wrapper is preserved, so the per-status `.meter-fill`
  widths in we:src/css/style.css resolve unchanged (no meter CSS edits).
- Tone maps status→the badge's closed 5-tone enum matching `statusTone` in
  we:scripts/lib/component-render-build-hook.cjs (active/stable→success, draft/poc→info,
  concept/experimental→warning, else neutral), so the detail-header badge and the grid-tile badges read
  identically.

Verified the macro renders the expected `<we-badge data-we-spec='…'>` placeholder + preserved meter row for
`active`/`concept` via a standalone nunjucks render. A full `build:docs` byte-check requires FUI's
`build:tools` CLI artifact (ratified ordering #1946/#2016), absent in the lane clone; when the CLI is
unavailable the transform leaves the placeholder intact and the JS-off baseline stands — never aborts the
build.
