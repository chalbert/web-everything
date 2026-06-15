---
type: idea
workItem: story
size: 8
parent: "623"
status: resolved
blockedBy: ["626"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: none
relatedProject: webdocs
crossRef: { url: /backlog/604-migrate-the-we-site-to-render-real-frontier-ui-blocks-replac/, label: "Converges with — render real FUI blocks (#604)" }
tags: [webdocs, catalog, blocks-index, build, surface]
---

# Assemble the Web Docs component-catalog surface from the derived standards

Build the navigable docs/catalog surface (the **Storybook-equivalent**) from the intents/blocks named by the
derivation decision ([#626](626-map-workbench-features-to-we-standards-which-intents-blocks-.md)). **Converges with**
[#604](604-migrate-the-we-site-to-render-real-frontier-ui-blocks-replac.md) (render real FUI blocks) and
[#398](398-build-the-web-docs-product-fui-open-primitives-plateau-app-o.md) (served product) — does **not** fork a
parallel build; it consumes their render pipeline.

## Quick-win first slice (workable before the full chain) — DONE

- [x] A **`/blocks/` index page** — a sibling of `/intents/` + `/protocols/`, enumerating
      [blocks.json](../src/_data/blocks.json) with intent/trait filters. This is the missing "browse all components"
      surface and can ship independently of #624–#626 as the catalog skeleton.

## Full surface (after #626) — carved to #727 (blocked on #604)

- [ ] Render each minted/reused feature (story canvas, props table, token table, a11y panel…) onto the catalog.
- [ ] Wire real FUI block render via #604's pipeline (not static specs).
- [ ] Per-component page = spec + live example + source, navigable from the `/blocks/` index.

## Progress (2026-06-15, batch-2026-06-15) — catalog skeleton shipped; live surface carved out

- **Shipped the `/blocks/` index** [`src/blocks.njk`](../src/blocks.njk) — the Storybook-equivalent browse
  surface, sibling of `/intents/` + `/protocols/`, auto-rendering from `blocks.json` (69 cards). Filters:
  **trait surface** (`type`) + **status** checkboxes + a text search over name/summary/intent; each card links
  to `/blocks/{id}/`. Wired into the Standards nav ([base.njk](../src/_layouts/base.njk)) and documented in the
  catalog-auto-render note ([docs/agent/design-first.md](../docs/agent/design-first.md)). `check:standards` 0
  errors (incl. §9 Vite-proxy coverage — `/blocks/` was already proxied for the per-block pages); renders on the
  11ty build.
- **Full per-component live surface carved to [#727](727-web-docs-blocks-per-component-live-surface-fui-render-props-.md)**
  (`blockedBy: 604`) — the live FUI render (via #604's pipeline + the #701 fuiDemo iframe) + props/token/a11y
  panels are genuinely gated on the #604 render pipeline (held, D3-readiness) and consume #626's derivation.
  Resolving the skeleton here and tracking the gated bulk separately matches the body's "size 8 is provisional —
  likely re-sliced" note.

## Notes

Size 8 was provisional — re-sliced as anticipated: the `/blocks/` index skeleton shipped (this item); the
gated full per-component surface is #727. Everything beyond the index was gated on the #604 render pipeline.
