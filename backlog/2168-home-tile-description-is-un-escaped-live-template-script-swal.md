---
kind: task
status: resolved
relatedTo: ["2016", "2018", "777"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: none
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

## Resolution (2026-07-02, PR #11 → `a0a28711`)

Root cause confirmed WE-side: `renderProjectGrid` fed the description as a harness `html:` body part, set via
`innerHTML=`, which happy-dom **decodes** — its `.outerHTML` serializer then re-emits the raw `<template>`
(`fui:blocks/renderers/component-render/buildHarness.ts` documents this exact hazard). Fixed by applying the
**sentinel-splice** `renderBacklogGrid` already used for the same reason: render the card shell with a unique
`PROJECT_DESC_<i>` sentinel body, then string-splice the trusted, already-escaped description in verbatim —
bypassing the innerHTML round-trip, exactly as the pre-#2019 `| safe` template output did. Verified against the
real FUI CLI: built home has **0** live `<template>`/`<script>` in `.project-desc` (was 1); browser (JS off)
parses **3 grids / 47 cards / 0 empty** (was 1 grid / 32). Deterministic unit regression added in
`we:scripts/lib/__tests__/component-render-build-hook.test.mjs` (splice preserves `&lt;template&gt;`, keeps real
`<strong>`, replaces the sentinel).
