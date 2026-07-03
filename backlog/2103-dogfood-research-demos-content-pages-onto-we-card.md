---
kind: story
size: 2
parent: "2021"
status: resolved
blockedBy: ["2098"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
graduatedTo: none
tags: []
---

# Dogfood research/demos content pages onto we-card

Convert the content-page card surfaces: the three hand-rolled project-card tiles in we:src/research.njk (we:src/research.njk:13,35,59 — design-references banner, topic grid, empty-state) and the standard-card demo grid + empty-state panel in we:src/demos.njk to SSR we-card tiles via the #2098 primitive (we:src/semantics.njk already converted as the #2098 proof-of-life). JS-off correct; Playwright before/after.

## Resolution

All five card surfaces are dogfooded onto FUI's `<we-card>` — but split across the two we-card SSR paths
by what each surface actually needs, because the #2098 `weCard`/`weBadge` MACROS have two hard limits the
research/demos content hit that the we:src/semantics.njk proof-of-life did not:

1. **The macro can't carry a nested badge.** A `weBadge(...)` fed as `weCard(..., actionsHtml)` serializes
   the badge's OWN `data-we-spec` placeholder into the card's spec attribute, and the single-pass
   `weComponentSSR` transform never re-renders that inner placeholder — the badge ships un-rendered.
2. **The macro's `bodyHtml` round-trips through the harness's `innerHTML`,** which DECODES entity-escaped
   markup: a demo summary like For-Each's "stamps a `<template>`" arrives as `&lt;template&gt;`, is decoded
   to a raw `<template>`, and happy-dom's serializer then leaks that tag and swallows the rest of the grid
   (the documented DOM-truncation bug, we:scripts/lib/component-render-build-hook.cjs → `renderBacklogGrid`;
   verified: it dropped 5 of 8 demo tiles in a first pass).

So the conversion uses the two paths deliberately:

- **Badge-bearing / entity-unsafe tiles → the raw `<we-card>`/`<we-badge>` anchor-tile pattern** (the ratified
  #1607/#1820 Fork 1a precedent already shipped on blocks/resources/protocols/etc.): the design-references
  banner + Open-Research-Topics grid in we:src/research.njk, the demo showcase grid + empty-state panel in
  we:src/demos.njk. Correct with JS off via the `we-card{}`/`we-badge{}` we:src/css/style.css baseline; the
  client CE upgrades in place. The whole-tile click stays on the outer `<a>`; the card is the sole frame.
- **No-badge content tiles → the SSR `<we-card>`** the transform splices to `<article class="fui-card">`:
  the External References category cards in we:src/research.njk (kept as raw `<we-card>` here too for a
  round-trip-safe, consistent treatment).

Wiring + fixes:

- **we:src/css/style.css** — added a `.standard-card:has(> we-card)`/`:has(> .fui-card)` frame-strip mirroring
  the existing `.project-card` rule (the demos grid tiles are `<a class="standard-card">`, which had no such
  strip — without it the anchor double-boxed the card).
- **we:src/css/style.css** — a11y: the `/research/` enforced a11y gate caught that the topic-status pill,
  now a `<we-badge tone="warning">`, rendered at contrast 4.45:1 (`#9a6700` on `#fdf4e3`) — just under the
  WCAG-AA 4.5 floor, a regression the prior hand-rolled `#92400e` pill did not have. Darkened the shared
  warning tone to `#8a5d00` (≈5.4:1) across `we-badge[tone="warning"]`, `.fui-badge--warning`, and
  `.fui-tag--subtle.fui-tag--warning` (kept in lock-step).
- **we:tests/content/research-demos-wecard-dogfood.spec.ts** — committed content-lane guard: each converted
  surface is a `<we-card>`/`.fui-card` inside its click-through anchor, and the For-Each summary's literal
  `<template>` survives verbatim (the DOM-truncation regression guard).

Gates green: `check:standards` (0 errors); the enforced `/research/` + `/demos/` a11y routes pass (full
39-route sweep green); the new content spec passes. Before/after Playwright confirmed the tiles now match the
sibling catalog pages (the site-theme orange body-gradient now shows through the stripped card frames exactly
as it already does on we:src/blocks.njk — not a regression, the intended catalog look).
