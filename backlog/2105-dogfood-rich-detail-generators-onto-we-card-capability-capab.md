---
kind: story
size: 3
parent: "2021"
status: resolved
blockedBy: ["2098", "2099"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: []
---

# Dogfood rich detail generators onto we-card (capability/capability-adapter/demo/research-topic sweep)

Convert the ~17 section-card fui-card panels + detail headers across we:src/capability-pages.njk (4 panels), we:src/capability-adapter-pages.njk (3), we:src/demo-pages.njk (5, incl. the gradient hero panel), we:src/research-topic-pages.njk (5) to SSR we-card via the #2098 primitive, headers riding the #2099 shared status-badge macro. Presentational tables stay plain per #1964. JS-off correct; Playwright before/after per family.

## Resolution

All 17 `section-card fui-card` panels across the four generator templates converted to the `weCard` macro
(#2098 primitive), with CSS classes carrying per-card visual overrides:

- **we:src/capability-pages.njk** (4 panels) — overview/detail-list card (no title, `<dl>` stays as HTML),
  build-matrix row card (presentational `<table>` stays plain per #1964, `weCard` title="Build-matrix row"),
  conditional requiring-intents card, and underlying-platform-feature card. `weCard` imported from
  we:src/_includes/we-component.njk; each panel body captured via `{% set %}` before the `weCard` call.

- **we:src/capability-adapter-pages.njk** (3 panels) — adapter description card (includes a partial),
  tier-breakdown card (presentational tier chips, no data-table), and other-registered-adapters grid card.

- **we:src/demo-pages.njk** (5 panels, incl. gradient hero) — hero card now uses a new `.demo-hero-card`
  CSS class (applied via `className`) to carry the gradient background + white text that were previously
  inline styles on the `<div>`; live-demo embed card; conditional standards-required card (dynamic title
  rendered via `_demoReqsTitle` set); overview card; conditional source-code card.

- **we:src/research-topic-pages.njk** (5 panels) — superseded-revision warning card now uses a new
  `.research-superseded-card` CSS class for the amber border-left + yellow background previously inline;
  meta-info card (summary/tags/dates/freshness badge, no title); description include card; conditional
  revision-history card; conditional related-blocks grid card.

- **we:src/css/style.css** — added `.demo-hero-card` (gradient + white text) and `.research-superseded-card`
  (amber left-border accent) rules anchored to `#2105`, covering both the pre-upgrade `<we-card>` tag and
  the SSR-spliced `<article class="fui-card">`.

All panels: `weCard` body uses `{% set %}` capture per the #2098 we:src/semantics.njk proof-of-life pattern;
the `weComponentSSR` build transform batches all placeholders on each page to the pinned FUI CLI in one
subprocess call; the client `<we-card>` CE upgrade is a pure enhancement over the JS-off baseline.
Presentational `<table>` elements inside cards stay as plain HTML per #1964 (no `<we-data-table>` wrap).
Status-badge headers ride the #2099 `projectStatus` macro unchanged (already converted in-lane).
