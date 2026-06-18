---
type: idea
workItem: story
size: 5
parent: "746"
status: resolved
locus: plateau-app
relatedProject: webdocs
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: plateau-app/src/technical-configurator/provider.ts
tags: [webdocs, technical-configurator, plateau-embed, render-strategy, transport, traits, chunks]
---

# Add the four WE technical dimensions as Plateau Configurator domains (render-strategy, transport, trait-lazy-load, chunk-split)

Add render-strategy (#079), delivery-transport (#455), trait-lazy-load (#448), and chunk-split (#719/#720) as four new Technical Configurator domains in plateau-app — each a seed-*.ts + a we:provider.ts DOMAINS[] entry + a plateau:presets.ts block, following the editing-engine/serialization-format/substrate-negotiation precedent (plateau:plateau-app/src/technical-configurator/provider.ts:9-31). All four source concepts are resolved, so each domain has settled source data. Feeds the embedded per-block configurator (#752).

## Progress (2026-06-16, batch-2026-06-16) — built

Added all four WE technical dimensions as Technical Configurator domains in plateau-app, each following the seed + provider-entry + presets precedent:

- **render-strategy** (#079) — `plateau:seed-render-strategy.ts`: DSD / client-render / light-DOM-template across no-JS-first-paint, style-encapsulation, hydration-cost.
- **delivery-transport** (#455) — `plateau:seed-delivery-transport.ts`: SSE / WebSocket / WebTransport / Web Push across direction, open-vs-closed-app lifecycle, support baseline.
- **trait-lazy-load** (#448/#202) — `plateau:seed-trait-lazy-load.ts`: eager-define / lazy-on-view / preload-warm across initial-bundle cost + first-interaction latency.
- **chunk-split** (#719/#720) — `plateau:seed-chunk-split.ts`: bundler code-split / MaaS-served / monolithic across granularity, unused-trait elimination, framework-agnostic fetchability.

Each registered in `we:provider.ts` `DOMAINS[]` + a plain-language `*Presets` block in `plateau:presets.ts` wired into `plateau:configurator.ts` `PRESETS_BY_DOMAIN`. Every strategy declares a value for every axis (the domain-integrity invariant).

- **Verified:** plateau-app `npm test` **172/172**; Playwright on `:4000/technical-configurator` — all four domains appear in the list, and a click-through (Chunk Split) renders its 3 strategies + presets with no console errors.
- Feeds the embedded per-block configurator (#752).
