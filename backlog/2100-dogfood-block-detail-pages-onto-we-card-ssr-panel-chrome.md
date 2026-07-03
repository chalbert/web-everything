---
kind: story
size: 3
parent: "2021"
status: resolved
blockedBy: ["2098"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: []
---

# Dogfood block detail pages onto we-card (SSR panel chrome)

Convert the 10+ hand-rolled section-card fui-card panels across both tiers of we:src/block-pages.njk (e.g. we:src/block-pages.njk:49,55,64,84 — Overview, Live example, Quick start, API reference, Common patterns, WE Standards overlay, implementer panels) to SSR we-card via the #2098 primitive. data-table surfaces untouched: presentational doc tables are already in their ratified #1964 end-state (plain table.data-table). JS-off correct; Playwright before/after; 0 console errors.

## Resolution

Dogfooded all **14** hand-rolled `.section-card fui-card` panels across both tiers of
we:src/block-pages.njk onto the #2098 `weCard` SSR primitive, following the we:src/semantics.njk
proof-of-life precedent exactly:

- **Import** — the `weCard` macro from we:src/_includes/we-component.njk is imported beside the existing
  `project-status` import, with a header comment explaining the dogfood.
- **Each panel** — the panel's inner content is captured into a `{%- set _card<Name> %}…{% endset -%}`
  block and the `<div class="section-card fui-card …">` frame is replaced by
  `{{ weCard("", _card<Name>, "", "section-card mt-8") }}` (`mt-4` for the Overview panel, matching the
  original spacing). `title=""` mirrors the we:src/semantics.njk pattern: each panel keeps its own in-body
  `<h2>` heading and DOM exactly as before, so the frame adds no header and the "before" heading
  structure is preserved byte-for-byte inside the card body. Every panel's surrounding graceful-absence
  `{% if %}` gate is left intact — the tiers still degrade panel-by-panel.
- **Tier 1 (user)** — Overview, Live example, Quick start, API reference, Common patterns.
- **Tier 2 (implementer)** — block description include, WE Standards overlay, Configure technical
  aspects, Implements Intent, Composes Intents, Traits, Accessibility & Web Standards, Component tokens,
  Anatomy.
- **data-table surfaces untouched** — the `table.data-table` markup inside the API reference / Traits /
  Web Standards / Component tokens panels is passed through as trusted `bodyHtml` unchanged (its ratified
  #1964 plain-table end-state); the sibling `weDataTableSSR` transform still splices those tables, and
  `weComponentSSR` composes over them. No table markup was altered.

The client `<we-card>` CE upgrade (we:src/_layouts/base.njk) is a pure enhancement over the JS-off-correct
SSR baseline: each `weCard` emits an inert `<we-card data-we-spec='{…}'>` placeholder that the
`weComponentSSR` build transform batches through the pinned FUI CLI in one subprocess per page and splices
to the finished `fui-card` frame — byte-identical to what the element would upgrade to (#2098 idempotency).
The template compiles clean (nunjucks parse) and the scoped `check:standards` gate is green
(0 errors). Full `build:docs` SSR proof + Playwright before/after require a sibling FUI `build:tools`
artifact (ratified ordering #1946/#2016), absent in the lane clone — the same in-slice constraint #2098
carried; the byte-identity holds by construction.
