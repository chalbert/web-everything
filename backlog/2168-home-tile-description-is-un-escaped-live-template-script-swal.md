---
kind: task
status: resolved
relatedTo: ["2016", "2018", "777"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: [bug, ssr, component-render, home, rendering, escaping]
---

# Home tile description is un-escaped → a live `<template>`/`<script>` swallows 2 of 3 grids

**Symptom (found via Playwright screenshot; invisible in curl/view-source):** the home page renders only its
FIRST grid — "Core Standards" (32 tiles) — while the **Protocols** and **Implementations** grids (the other
~15 tiles) never appear in the browser DOM (`document.querySelectorAll('.project-grid').length === 1`, cards
32 of 47). The served HTML has all 3 grids / 47 tiles; the browser drops 2 grids during parsing.

**Root cause — the render pipeline un-escapes the tile description.** `we:src/_data/projects/webrouting.json`
`description` correctly escapes its code example as `&lt;template route="/users/:id"&gt;` / `&lt;we-route-view&gt;`
(0 live tags in source). But the **built** card body contains a **live** `<template route="/users/:id">`. A real
`<template>` parses its contents into an inert `DocumentFragment`, so every sibling after it (the rest of the grid
+ the next two grids) is absorbed out of the rendered tree. (The tile also pulls a demo `<script>`, same hazard —
`<script>` parses as raw text until `</script>`.)

So somewhere between the source `&lt;…&gt;` and the emitted card, the entity-encoded description is
**HTML-decoded** back to live tags. The description is fed as a trusted-HTML body part:
`we:scripts/lib/component-render-build-hook.cjs` `renderProjectGrid` → `bodyParts:[{tag:'p', className:'project-desc',
html: project.description}]` → the FUI component-render CLI (`fui:dist/tools/component-render/cli.mjs`). One of those
hops decodes `bodyParts[].html`.

**Fix direction:** the body-part `html` is already final markup — the splice/renderer must **inject it verbatim,
never entity-decode it**. Locate the decode (WE splice in `we:scripts/lib/component-render-build-hook.cjs`, or FUI's
`bodyParts` handling in the component-render harness) and stop it. Add a regression assertion: built home has
0 live `<template>`/`<script>` inside `.project-desc`, and the browser parses all 3 `.project-grid`s.

**Note:** distinct from the nested-anchor ghost-card bug (fixed in `lane/home-card-nested-anchor-fix`) — that was
tile *duplication*; this is tile *swallowing*. Both were masked from curl/DOM-count checks and only visible in the
rendered browser DOM / screenshot.
