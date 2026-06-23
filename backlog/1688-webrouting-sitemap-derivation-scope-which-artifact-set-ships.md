---
kind: decision
parent: "1684"
status: open
dateOpened: "2026-06-23"
locus: webeverything
tags: [webrouting, routing, sitemap, prerender, derivation]
---

# webrouting sitemap derivation scope — which artifact set ships in v1

Decide which artifacts webrouting derives from the route table in v1. Candidates, all derivable from one route table: a crawler sitemap.xml, an in-app navigation-tree/IA map, a prerender/static-render manifest, and a Speculation-Rules prefetch manifest. Frame sitemap as a derivation with a pluggable emitter set; this fork picks the v1 emitters and defers the rest.

## What you have to decide

Which **derived artifacts** webrouting emits from the canonical route table (#1685) in v1, framed as a pluggable emitter set so the rest are deferred, not designed-out.

## Candidate emitters (to be researched + given a default by `/prepare`)

- **Crawler `sitemap.xml`** — the SEO artifact; static URLs from the route table. Note parametric routes (`/users/:id`) can't be enumerated without a data source — scope how dynamic routes are handled.
- **In-app navigation-tree / IA map** — a structured route tree for breadcrumbs, menus, and nav blocks (composes with the Navigation Intent `structure` axis).
- **Prerender / static-render manifest** — the list of routes to statically render at build time.
- **Speculation-Rules prefetch manifest** — declarative prefetch/prerender rules (the `router` block already references the Speculation Rules API, `we:src/_data/blocks/router.json`).

## Grounding to gather (`/prepare`)

How each artifact is produced from a route table; how parametric/dynamic routes are enumerated (or excluded) per artifact; prior art (Next/SvelteKit sitemap + prerender, `@11ty` sitemap, speculation-rules generators); whether the emitter set is itself a swap seam. Confirm no overlap with the docs-site's own `we:src/sitemap.njk` (that is the 11ty docs sitemap, unrelated to app routing).

**Next step:** `/prepare 1688` — survey, publish a `/research/` topic, state options + a bold default + confidence, set `preparedDate`.
