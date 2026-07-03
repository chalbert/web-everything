---
kind: task
status: active
relatedTo: ["2168"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
tags: [bug, catalog, tiles, rendering, testing, plugs]
---

# Extend the tile-integrity guard to all catalog grids + fix the remaining nested-anchor grids (plugs)

The nested-anchor ghost-card fix (`lane/home-card-nested-anchor-fix`) covered the SSR grids (home/intents) and
`we:src/adapters.njk`, with a regression test on `/`, `/intents/`, `/adapters/`
(`we:tests/interaction/catalog-tile-no-nested-anchor.spec.ts`). But a browser sweep of every catalog surface
showed more grids fail the rendered-DOM integrity check:

- **`/plugs/`** — served ~59 tiles, browser parses ~38: a **tile-swallow** (browser DOM << source), the same
  class as #2168 (a live `<template>`/`<script>` or other invalid nesting in a tile body). Needs its own probe.
- Audit the remaining hand-rolled njk grids that wrap `<a class="project-card">` around a `<we-card>` whose
  body can hold links: `we:src/states.njk`, `we:src/blocks.njk`, `we:src/protocols.njk`. They tested clean today
  (their summaries have no inline links), but the wrapping-anchor pattern is a **latent footgun** — convert them
  to the same `.project-card-link` overlay pattern for uniformity + future-proofing. (`we:src/presets.njk` already
  uses `<article>`, so it is safe.)

**Deliverable:** (1) extend `we:tests/interaction/catalog-tile-no-nested-anchor.spec.ts` to cover `/plugs/`,
`/states/`, `/blocks/`, `/protocols/`, `/presets/` (assert `a a` === 0, zero empty `.project-card`, and — to catch
the #2168 swallow class — browser `.project-card` count === served-HTML tile count); (2) fix whatever it flags.

The general lesson: these are **rendered-DOM** defects invisible to curl/view-source/innerText/console — the
smoke lane (element-count>15) passes them green. Tile integrity must be asserted against the *parsed browser DOM*.
