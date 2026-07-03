---
kind: story
size: 2
parent: "2021"
status: resolved
blockedBy: ["2098", "2018"]
graduatedTo: none
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: []
---

# Dogfood backlog detail pages onto we-card (panels; parity with the converted tile)

Convert the 4 section-card fui-card panels of we:src/backlog-pages.njk (body, Contains, Blocked by, References) to SSR we-card via the #2098 primitive. Header badges keep the shared we:src/_includes/backlog-badges.njk macros exactly as #2018 converts them (ONE source with the tile — the tile-subset-of-detail parity rule, we:src/backlog-pages.njk:143-155). Rides behind #2018 (active, uncommitted working-tree edits on this file). JS-off correct; Playwright before/after.

## Resolution

All 4 section-card panels of `we:src/backlog-pages.njk` now render through the generic SSR `weCard` macro
(#2098's `we:src/_includes/we-component.njk`), the same render-from-data primitive `we:src/semantics.njk`
uses. Each panel body is captured with `{% set %}` and passed as trusted `bodyHtml`; the panel's frame
classes (`section-card`, `section-card mt-8`) ride onto the FUI card via the macro's `className` arg. The
`weComponentSSR` build transform batches every placeholder on the page through the pinned FUI CLI in one
subprocess and splices each to its finished `<article class="fui-card …">`.

- Header badges untouched — they keep the shared `we:src/_includes/backlog-badges.njk` macros, preserving the
  tile-subset-of-detail parity rule (#2018 converted the tile grid; this is the detail-panel half).
- Verified against the built site (this item's detail page under `we:_site/backlog/`): 0 unspliced
  `data-we-spec` placeholders, 0 raw `<we-card>` tags, panels emitted as `<article class="fui-card
  section-card">` / `…section-card mt-8`, and the JS-off body (item details, tags, "Opened:", "Blocked by"
  list) present in the static SSR HTML.
- Scoped `check:standards --local` on the changed file: 0 errors.
